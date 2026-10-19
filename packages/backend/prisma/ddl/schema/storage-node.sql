-- Install native schema objects after Prisma schema synchronization.
-- These functions own storage-tree consistency,
-- not permissions, inventory execution, or public tree queries.
BEGIN;
SET LOCAL search_path = public, pg_temp;

CREATE UNIQUE INDEX IF NOT EXISTS "StorageNode_root_code_key"
ON "StorageNode" ("topologyId", code) WHERE "parentId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "StorageTopology_active_facility_key"
ON "StorageTopology" ("facilityId") WHERE "archivedAt" IS NULL;

-- A subtree changes composite parent keys together; validate their final state.
DO $$
DECLARE constraint_name text;
BEGIN
    FOR constraint_name IN SELECT conname FROM pg_constraint
        WHERE conrelid = 'public."StorageNode"'::regclass
          AND confrelid = 'public."StorageNode"'::regclass AND contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE public."StorageNode" DROP CONSTRAINT %I', constraint_name);
    END LOOP;
    ALTER TABLE "StorageNode" ADD CONSTRAINT "StorageNode_organizationId_topologyId_parentId_fkey"
        FOREIGN KEY ("organizationId", "topologyId", "parentId")
        REFERENCES "StorageNode" ("organizationId", "topologyId", id)
        ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_node_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    parent_path ltree;
    parent_kind "StorageNodeKind";
    parent_archived_at timestamptz;
    expected_path ltree;
BEGIN
    IF TG_OP = 'UPDATE' AND (
        NEW.id IS DISTINCT FROM OLD.id
        OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
    ) THEN
        RAISE EXCEPTION 'Storage node identity and organization are immutable'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind THEN
        RAISE EXCEPTION 'Storage node kind is immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        PERFORM id FROM "StorageTopology" WHERE id IN (OLD."topologyId", NEW."topologyId") ORDER BY id FOR UPDATE;
    END IF;
    -- Mutating the topology row also detects stale repeatable-read snapshots.
    IF TG_OP = 'DELETE' THEN
        UPDATE "StorageTopology" SET "updatedAt" = clock_timestamp()
        WHERE id = OLD."topologyId" AND "organizationId" = OLD."organizationId";
        RETURN OLD;
    ELSIF TG_OP = 'INSERT'
        OR NEW."parentId" IS DISTINCT FROM OLD."parentId"
        OR NEW."topologyId" IS DISTINCT FROM OLD."topologyId"
        OR NEW.kind IS DISTINCT FROM OLD.kind THEN
        UPDATE "StorageTopology" SET "updatedAt" = clock_timestamp()
        WHERE id = NEW."topologyId" AND "organizationId" = NEW."organizationId";
    ELSE
        PERFORM 1 FROM "StorageTopology"
        WHERE id = NEW."topologyId" AND "organizationId" = NEW."organizationId"
        FOR UPDATE;
    END IF;

    IF TG_OP = 'INSERT' THEN
        expected_path := replace(NEW.id::text, '-', '')::ltree;
        IF NEW."parentId" IS NOT NULL THEN
            SELECT path, kind, "archivedAt"
            INTO parent_path, parent_kind, parent_archived_at
            FROM "StorageNode"
            WHERE id = NEW."parentId" AND "organizationId" = NEW."organizationId"
              AND "topologyId" = NEW."topologyId";
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Parent storage node does not exist in this topology'
                    USING ERRCODE = '23503';
            END IF;
            IF parent_kind <> 'CONTAINER' OR parent_archived_at IS NOT NULL THEN
                RAISE EXCEPTION 'Parent must be an active storage container'
                    USING ERRCODE = '23514';
            END IF;
            expected_path := parent_path || expected_path;
        END IF;
        IF NEW.path IS NOT NULL AND NEW.path <> expected_path THEN
            RAISE EXCEPTION 'Storage node path must match its parent and identity'
                USING ERRCODE = '23514';
        END IF;
        NEW.path := expected_path;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_node_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    node "StorageNode"%ROWTYPE;
    parent_path ltree;
    parent_kind "StorageNodeKind";
    expected_path ltree;
BEGIN
    -- Deferred events may reference an earlier row version; validate final state.
    SELECT * INTO node FROM "StorageNode" WHERE id = NEW.id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    expected_path := replace(node.id::text, '-', '')::ltree;
    IF node."parentId" IS NOT NULL THEN
        SELECT path, kind INTO parent_path, parent_kind FROM "StorageNode"
        WHERE id = node."parentId" AND "organizationId" = node."organizationId"
          AND "topologyId" = node."topologyId";
        IF NOT FOUND OR parent_kind <> 'CONTAINER' THEN
            RAISE EXCEPTION 'Parent must be a container in the same topology'
                USING ERRCODE = '23514';
        END IF;
        expected_path := parent_path || expected_path;
    END IF;
    IF node.path IS DISTINCT FROM expected_path THEN
        RAISE EXCEPTION 'Storage node path and parent are inconsistent'
            USING ERRCODE = '23514';
    END IF;
    IF (node."rowIndex" IS NULL) <> (node."columnIndex" IS NULL)
        OR (node."rowCount" IS NULL) <> (node."columnCount" IS NULL)
        OR node."rowIndex" < 1 OR node."columnIndex" < 1
        OR node."rowCount" < 1 OR node."columnCount" < 1
        OR (node."parentId" IS NULL AND node."rowIndex" IS NOT NULL)
        OR (node.kind = 'POSITION' AND (node."containerType" IS NOT NULL OR node."rowCount" IS NOT NULL))
        OR (node.kind = 'CONTAINER' AND node."containerType" IS NULL) THEN
        RAISE EXCEPTION 'Invalid storage node shape' USING ERRCODE = '23514';
    END IF;
    IF node."parentId" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "StorageNode" parent WHERE parent.id = node."parentId"
        AND ((node."rowIndex" IS NOT NULL AND (parent."rowCount" IS NULL
             OR node."rowIndex" > parent."rowCount" OR node."columnIndex" > parent."columnCount"))
          OR (node."rowIndex" IS NULL AND parent."rowCount" IS NOT NULL))
    ) THEN
        RAISE EXCEPTION 'Storage coordinate is outside its parent layout' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM "StorageNode" child WHERE child."parentId" = node.id
        AND ((node."rowCount" IS NULL AND child."rowIndex" IS NOT NULL)
          OR (node."rowCount" IS NOT NULL AND (child."rowIndex" IS NULL OR child."rowIndex" > node."rowCount" OR child."columnIndex" > node."columnCount")))) THEN
        RAISE EXCEPTION 'Existing children do not fit the new layout' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1 FROM "StorageNode" child
        WHERE child."organizationId" = node."organizationId"
          AND child."topologyId" = node."topologyId" AND child."parentId" = node.id
          AND (node.kind <> 'CONTAINER'
               OR child.path <> node.path || replace(child.id::text, '-', '')::ltree)
    ) THEN
        RAISE EXCEPTION 'Storage children must have consistent paths under a container'
            USING ERRCODE = '23514';
    END IF;
    IF node.kind <> 'POSITION' AND EXISTS (
        SELECT 1 FROM "Placement" WHERE "storageNodeId" = node.id
    ) THEN
        RAISE EXCEPTION 'An occupied storage node must remain a position'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS storage_node_guard ON "StorageNode";
CREATE TRIGGER storage_node_guard
BEFORE INSERT OR DELETE OR UPDATE OF id, "organizationId", "topologyId", "parentId", path, kind
ON "StorageNode" FOR EACH ROW EXECUTE FUNCTION public.storage_node_guard();

DROP TRIGGER IF EXISTS storage_node_validate ON "StorageNode";
CREATE CONSTRAINT TRIGGER storage_node_validate
AFTER INSERT OR UPDATE ON "StorageNode"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.storage_node_validate();

DROP FUNCTION IF EXISTS public.storage_node_move(uuid, uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.storage_node_move(
    organization_id uuid, topology_id uuid, target_topology_id uuid, node_id uuid,
    parent_id uuid, target_code text, target_row integer, target_column integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    old_path ltree;
    new_path ltree;
    parent_path ltree;
    parent_kind "StorageNodeKind";
    parent_archived_at timestamptz;
BEGIN
    PERFORM id FROM "StorageTopology" WHERE id IN (topology_id, target_topology_id)
        AND "organizationId" = organization_id ORDER BY id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM "StorageTopology" topology JOIN "Facility" facility ON facility.id = topology."facilityId"
        WHERE topology.id = target_topology_id AND topology."organizationId" = organization_id
          AND topology."archivedAt" IS NULL AND facility."archivedAt" IS NULL) THEN
        RAISE EXCEPTION 'Active target topology does not exist' USING ERRCODE = '23503';
    END IF;
    -- Lock before any node read or write; every topology mutation uses this row.
    UPDATE "StorageTopology" SET "updatedAt" = clock_timestamp()
    WHERE id = topology_id AND "organizationId" = organization_id
      AND "archivedAt" IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active storage topology does not exist'
            USING ERRCODE = '23503';
    END IF;
    SELECT path INTO old_path FROM "StorageNode"
    WHERE id = node_id AND "organizationId" = organization_id
      AND "topologyId" = topology_id AND "archivedAt" IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active storage node does not exist in this topology'
            USING ERRCODE = '23503';
    END IF;
    new_path := replace(node_id::text, '-', '')::ltree;
    IF parent_id IS NOT NULL THEN
        SELECT path, kind, "archivedAt" INTO parent_path, parent_kind, parent_archived_at
        FROM "StorageNode" WHERE id = parent_id AND "organizationId" = organization_id
          AND "topologyId" = target_topology_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Parent storage node does not exist in this topology'
                USING ERRCODE = '23503';
        END IF;
        IF parent_kind <> 'CONTAINER' OR parent_archived_at IS NOT NULL
            OR (topology_id = target_topology_id AND parent_path <@ old_path) THEN
            RAISE EXCEPTION 'Cannot move a node into a position, archived node, or its own subtree'
                USING ERRCODE = '23514';
        END IF;
        new_path := parent_path || new_path;
    END IF;
    UPDATE "StorageNode" SET
        "topologyId" = target_topology_id,
        "parentId" = CASE WHEN id = node_id THEN parent_id ELSE "parentId" END,
        code = CASE WHEN id = node_id THEN coalesce(target_code, code) ELSE code END,
        "rowIndex" = CASE WHEN id = node_id THEN target_row ELSE "rowIndex" END,
        "columnIndex" = CASE WHEN id = node_id THEN target_column ELSE "columnIndex" END,
        path = CASE WHEN id = node_id THEN new_path
                    ELSE new_path || subpath(path, nlevel(old_path)) END,
        "updatedAt" = clock_timestamp()
    WHERE "organizationId" = organization_id AND "topologyId" = topology_id
      AND path <@ old_path;
END;
$$;

-- Reject inconsistent pre-existing paths instead of silently repairing history.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "StorageNode" node
        LEFT JOIN "StorageNode" parent ON parent.id = node."parentId"
          AND parent."organizationId" = node."organizationId"
          AND parent."topologyId" = node."topologyId"
        WHERE (node."parentId" IS NULL
               AND node.path <> replace(node.id::text, '-', '')::ltree)
           OR (node."parentId" IS NOT NULL
               AND (parent.id IS NULL OR parent.kind <> 'CONTAINER'
                    OR node.path <> parent.path || replace(node.id::text, '-', '')::ltree))
    ) THEN
        RAISE EXCEPTION 'Existing storage paths are inconsistent; review the path upgrade first';
    END IF;
    IF EXISTS (
        SELECT 1 FROM "Placement" placement
        JOIN "StorageNode" node ON node.id = placement."storageNodeId"
        WHERE node.kind <> 'POSITION'
    ) THEN
        RAISE EXCEPTION 'Existing stock occupies a non-position storage node';
    END IF;
END;
$$;

COMMIT;
