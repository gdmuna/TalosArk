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
    identity.sql
    storage-node.sql
  upgrade/
    README.md
  README.md
```

- `init/` prepares database-wide prerequisites without depending on business tables.
- `schema/` installs native schema objects that supplement Prisma-managed tables.
- `upgrade/` is reserved for future reviewed operational policy. It currently
  contains no executable SQL and is not part of new-database initialization.

| File                                                           | Execution point                                             | Ownership                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| [init/extension.sql](init/extension.sql)                       | Before schema synchronization                               | Native database prerequisites; currently only `ltree` |
| [schema/storage-node.sql](schema/storage-node.sql)             | After schema synchronization                                | Storage-node write invariants and subtree moves       |
| [schema/identity.sql](schema/identity.sql)                     | After synchronization, before account writes                | Canonical email CHECK; Prisma owns uniqueness         |

Do not execute all DDL stages recursively or alphabetically. Prisma schema
synchronization belongs between `init/` and `schema/`. `db:init` executes regular
`.sql` files directly in `init/`, in filename order; `db:prepare` is its
compatibility alias. `db:apply-ddl` still targets only `schema/storage-node.sql`.
No initialization command includes files from `schema/` or `upgrade/`.
P01 adds `db:apply-identity-ddl` for identity.sql; it is not included in the
storage-only `db:apply-ddl`. It validates canonical email storage with a CHECK,
then removes the old expression index. Prisma's ordinary email unique constraint
remains the only email uniqueness index. Existing noncanonical rows reject the
DDL transaction; no account values are silently rewritten.

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

## Upgrade Policy

Legacy upgrade scripts are not retained during the current reset phase.
[upgrade/](upgrade/README.md) remains a placeholder for future operational policy;
there is no approved automatic upgrade path for populated databases.
Review an explicit plan before changing existing data. Do not automatically
accept data-loss warnings or reset an existing database.

These development scripts are not a production upgrade-history replacement.
Before durable deployment, establish a reviewed business migration baseline and
include the extension DDL before any table/index using `ltree`, including shadow
database replay. No production synchronization was performed in this change.

## Email Write Contract

Identity writes `trim().toLowerCase()` email values. The native constraint
`User_email_normalized_check` checks `email = lower(btrim(email))`; it rejects
noncanonical values rather than converting them. Email syntax validation remains
the application's responsibility. `User.email @unique` owns concurrent uniqueness.
Username casing is unchanged. Installing this DDL does not create a second email
index and reapplying it reinstalls only its own CHECK.

CHECK failures are database invariants, not ordinary account validation failures.
Database normalization retains the original Prisma error in `cause`; Identity and
Auth propagate the technical error rather than mapping it to an account conflict.
The HTTP boundary returns the existing internal-error response (500) and logs at
error level without exposing SQL, parameters or raw database messages to clients.
The exact Prisma code depends on the installed adapter and query path; it must not
be inferred from the generic constraint error documentation alone.

Verification on 2026-10-14 used Prisma 7.10.0 with adapter-pg and temporary User
tables in talos-ark_backend_test. Model writes returned PrismaClientKnownRequestError
P2039 with SQLSTATE 23514; raw writes returned P2010 with the same SQLSTATE.
The managed query wrapper preserved the Prisma cause and marked rollback-only;
Identity propagated the same DatabaseError(query-failed), and the real HTTP filter
returned SYS_INTERNAL_ERROR/500 with an error-level log. Seven focused checks also
covered canonical writes, surrounding spaces, ordinary duplicate handling, DDL
reapplication and rollback when existing values violate the new CHECK.
No persistent User table, index, constraint or account was changed by these probes.
The new DDL has not been applied to an existing database in this change.

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
- Facility's private `StorageNodeWriter` exposes create/move through the public
  `FacilityStorageTopologyWriter` port. It joins the caller's active managed
  DatabaseRuntime transaction with mandatory propagation and uses queryClient;
  callers never cast to a native Prisma TransactionClient. Creation derives the
  path; moving calls `storage_node_move` and rewrites the entire subtree in that
  same transaction. Resource identity, authorization and audit remain the caller's
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
inheritance remains outside this DDL. I06 now provides parameterized lookup,
ancestor/children/descendant reads and context-bound cursor pagination in Facility,
without introducing TypedSQL generation. Its explicit read ceilings are not
authorization credentials. See [I06](../../docs/design/mvp-i06-2026-10-18.md) for
query, transaction and verification boundaries.

Prisma recommends native SQL for extension types and unsupported database
features: [PostgreSQL extensions](https://www.prisma.io/docs/orm/v7/prisma-schema/postgresql-extensions),
[unsupported features](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features).
The controlled `db execute` workflow does not record migration history:
[CLI reference](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference#db-execute).
