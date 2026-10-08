-- Optional upgrade for an existing adjacency-list database. Back up first.
-- Run after init/extension.sql and BEFORE syncing the required path field.
BEGIN;
SET LOCAL search_path = public, pg_temp;

LOCK TABLE public."StorageNode" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public."StorageNode" ADD COLUMN IF NOT EXISTS path ltree;

WITH RECURSIVE tree AS (
    SELECT id, "organizationId", "topologyId", replace(id::text, '-', '')::ltree AS path
    FROM public."StorageNode" WHERE "parentId" IS NULL
    UNION ALL
    SELECT child.id, child."organizationId", child."topologyId",
           parent.path || replace(child.id::text, '-', '')::ltree
    FROM public."StorageNode" child JOIN tree parent
      ON child."parentId" = parent.id AND child."organizationId" = parent."organizationId"
     AND child."topologyId" = parent."topologyId"
)
UPDATE public."StorageNode" node SET path = tree.path
FROM tree WHERE node.id = tree.id AND node.path IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public."StorageNode" WHERE path IS NULL) THEN
        RAISE EXCEPTION 'Cannot backfill storage paths: cycle or missing parent; upgrade rolled back';
    END IF;
END;
$$;

ALTER TABLE public."StorageNode" ALTER COLUMN path SET NOT NULL;

COMMIT;
