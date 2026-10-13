# Native Database DDL

This directory is the approved native DDL baseline for the reset-phase backend.
It is intentionally separate from `prisma/migrations`: these scripts do not
create `_prisma_migrations` history or recreate business tables. Do not use
`migrate deploy` and assume it will reconstruct the current MVP schema.

## Organization

Group scripts by lifecycle, not by a numeric sequence:

```text
ddl/
  init/
    extension.sql
  schema/
    storage-node.sql
  upgrade/
    storage-node-path.sql
  README.md
```

- `init/` prepares database-wide prerequisites without depending on business tables.
- `schema/` installs native schema objects that supplement Prisma-managed tables.
- `upgrade/` contains explicit upgrades for a particular existing data state;
  these scripts are not part of new-database initialization.

| File                                                           | Execution point                                             | Ownership                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| [init/extension.sql](init/extension.sql)                       | Before schema synchronization                               | Native database prerequisites; currently only `ltree` |
| [schema/storage-node.sql](schema/storage-node.sql)             | After schema synchronization                                | Storage-node write invariants and subtree moves       |
| [schema/identity.sql](schema/identity.sql)                     | After synchronization, before account writes                | Normalized case-insensitive email uniqueness          |
| [upgrade/storage-node-path.sql](upgrade/storage-node-path.sql) | Existing adjacency-list tables only, before synchronization | Explicit, exclusive-lock path backfill                |

Do not execute all DDL stages recursively or alphabetically. Prisma schema
synchronization belongs between `init/` and `schema/`. `db:init` executes regular
`.sql` files directly in `init/`, in filename order; `db:prepare` is its
compatibility alias. `db:apply-ddl` still targets only `schema/storage-node.sql`.
No initialization command includes files from `schema/` or `upgrade/`.
P01 adds `db:apply-identity-ddl` for identity.sql; it is not included in the
storage-only `db:apply-ddl`. Its expression index supplements Prisma's ordinary
email unique constraint and refuses pre-existing normalized collisions.

Without an explicit environment selector, database commands prompt in an
interactive terminal. CI/non-interactive calls require `--env` or `--env-file`.
See [the CLI guide](../../ops/prisma/README.md) for selection and automation.

No script runs on application startup, client generation, or container startup.
Executing DDL is an operator action against an explicitly selected environment.
The database administrator must make the extension available on the PostgreSQL
server and grant the deployment account permission to install it. The baseline
expects the `public` schema; it refuses a pre-existing `ltree` in another schema
instead of relocating it or silently installing unrelated extensions.

## New or Rebuildable Development Database

Run from the repository root:

```powershell
pnpm --filter @talos-ark/backend db:init --env dev.local
pnpm --filter @talos-ark/backend db:push --env dev.local
pnpm --filter @talos-ark/backend db:apply-identity-ddl --env dev.local
pnpm --filter @talos-ark/backend db:apply-ddl --env dev.local
pnpm --filter @talos-ark/backend db:gen-client --env dev.local
```

Database initialization and storage-node DDL can be reapplied. Initialization
targets the selected primary database only, not its shadow database. Each init
file owns its transaction; a failure stops the sequence without undoing earlier
committed files. The storage-node DDL reinstalls only its own functions/triggers
in one transaction and rejects inconsistent existing
paths or non-position occupancy. Repeat it after schema changes that could
replace the table. `db:push` alone is not the complete database setup.

## Existing Data

Do not push a new required `path` onto a populated `StorageNode` table without
backfilling it. Back up and use a maintenance window, then:

1. Apply `init/extension.sql`.
2. Execute `upgrade/storage-node-path.sql` using the selected Prisma environment.
3. Inspect the schema diff, including removal of `MaterialType.parentId`.
4. Apply the reviewed schema change and then `schema/storage-node.sql`.

```powershell
pnpm --filter @talos-ark/backend prisma db execute --file prisma/ddl/upgrade/storage-node-path.sql --env dev.local
```

The backfill takes an exclusive table lock, preserves IDs and parent references,
derives paths from reachable roots, and rolls back if a cycle or missing parent
leaves any path null. It fills null paths only; it does not silently overwrite an
existing inconsistent path. Root nodes are represented by one UUID label; a
topology may have multiple roots. The storage-node DDL subsequently verifies
parent/path consistency before installing the new write contract.

Flattening material classification removes the parent column and its foreign key;
it does not remove category IDs or material references. Export old relationships
first if needed. Do not automatically accept data-loss warnings or reset an
existing database. Historical journal paths cannot be reliably reconstructed
from a tree that may already have moved; new nullable path snapshots stay null
for old history unless a trustworthy source is available.

These development scripts are not a production upgrade-history replacement.
Before durable deployment, establish a reviewed business migration baseline and
include the extension DDL before any table/index using `ltree`, including shadow
database replay. No production synchronization was performed in this change.

## Storage Write Contract

- Each label is the lowercase UUID without hyphens, not a display name or code.
  Renaming a node does not change its path.
- `parentId` remains a same-organization/topology foreign key. `path` is required
  `Unsupported("ltree")`, with a GiST index. Its final label is the globally unique
  node ID, so validated paths are already unique without a redundant full-path
  B-tree index and its long-key size limit.
- Native paths are absent from generated Prisma result/input types. In the
  installed Prisma 7.10 client, create/upsert are omitted, while scalar update
  methods remain. Do not use a scalar `parentId` update to reparent a node.
- `createStorageNode` and `moveStorageNode` live in the facility persistence
  adapter and accept the caller's Prisma transaction. Creation derives the path;
  moving calls `storage_node_move` and rewrites the entire subtree in that same
  transaction. Resource identity, authorization and audit remain the caller's
  responsibilities. There is no new controller or business use case.
- Structural writes serialize on their topology row. The move function locks it
  before reading nodes; the guard also updates it on creation, deletion, parent
  changes and kind changes. Deadlocks or serialization failures abort a whole
  transaction; retry decisions belong to the future use case, not this writer.
- A deferred constraint trigger checks the final parent/path relationship and
  prevents POSITION nodes from becoming parents. Keep it deferred during subtree
  moves; forcing immediate validation would inspect intermediate row states.
- A move cannot change IDs, organizations, topologies, or move into its own
  subtree. Current inventory placements retain their stable node IDs. Inventory
  execution captures before/after paths as text in journal lines; topology moves
  never rewrite those historical snapshots.

These invariants do not enforce every inventory policy. In particular, placement
insertion still needs an authorized write path that verifies POSITION kind, and
archiving/repurposing occupied nodes needs its own business rules. Permission
inheritance, ancestor/subtree read APIs, TypedSQL and cursor pagination are
explicitly not implemented here.

Prisma recommends native SQL for extension types and unsupported database
features: [PostgreSQL extensions](https://www.prisma.io/docs/orm/v7/prisma-schema/postgresql-extensions),
[unsupported features](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features).
The controlled `db execute` workflow does not record migration history:
[CLI reference](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference#db-execute).
