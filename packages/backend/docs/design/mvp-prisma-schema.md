# MVP Prisma Model Design

Date: 2026-10-08. Scope: software MVP from `docs/product/mvp-scope.md`, not
the complete conceptual ER, frontend mock records, or hardware roadmap.

## Confirmed Decisions

The user confirmed these choices during schema implementation:

1. Materials belong exclusively to a workspace; no material sharing in MVP.
2. Track individual bottles/tubes, with remaining quantity and an optional batch.
   One physical instance has at most one current storage position.
3. Approval does not reserve or mutate inventory. Revalidate and apply changes
   only when execution is confirmed.
4. Software closure comes first. Real hardware integration is a later phase.
5. First-party account/password login and email password reset, alongside existing
   OIDC, are in MVP. Phone authentication is deferred.
6. MaterialType is a flat classification. Its previously assumed parent/child
   hierarchy is removed with the user's approval.
7. StorageNode retains its parent foreign key and gains a non-null native `ltree`
   path with immutable UUID labels. A single storage write contract maintains both.
8. Native foundation DDL is approved. The initial schema iteration deferred
   permission inheritance and tree reads; I06 now supplies bounded tree queries
   and cursor pagination, while permission inheritance remains deferred.

Organization remains the hard tenant boundary. Facility remains
organization-owned, with a management workspace and explicit workspace access;
this does not grant access to another workspace's materials or inventory.
The default acting context is the current workspace, not a separate acting-
workspace selector.

## Organization

`prisma/schema.prisma` contains only the generator and PostgreSQL datasource.
`prisma.config.ts` points at `prisma`, so Prisma loads the domain files together
and generates **one client**, not separate databases or clients per file.
The generated output stays at `prisma/generated`; existing imports stay valid.
The initial 2026-10-08 baseline had 17 domain files and 53 models: seven existing
identity/session models and 46 new models. I08-A later adds FileUploadSession;
the dated counts below describe the initial diff, not a fresh whole-schema inventory.

| File under `prisma/model` | Responsibility |
| --- | --- |
| `identity.prisma` | Existing users, profiles, OIDC identities, hashed password-reset credentials |
| `session.prisma` | Existing sessions, token pairs, access and refresh tokens |
| `organization.prisma` | Organization ownership, retained membership, hashed invitations |
| `workspace.prisma` | Workspace and tenant-consistent membership |
| `permission.prisma` | Allow-only permission catalog, scoped roles and role bindings |
| `resource.prisma` | Tenant-owned cross-cutting resource identity |
| `material.prisma` | Classification, definitions, aliases, identifiers, batches, physical instances |
| `facility.prisma` | Facilities, access, arbitrary-depth topology and exclusive positions |
| `inventory.prisma` | Current stock/placement, executed transactions and journal lines |
| `stocktake.prisma` | Scope, counts, expected versions and linked adjustments |
| `approval.prisma` | Fixed issue/transfer approval, lines and decision history |
| `task.prisma` | Ordinary assigned work and action history |
| `alert.prisma` | Quantity/count/expiry thresholds and software risk history |
| `notification.prisma` | Site notifications and per-recipient read/dismissal state |
| `file.prisma` | Storage objects, durable upload sessions, user-facing assets and resource-bound references |
| `equipment.prisma` | Basic registry and manual inspection/maintenance records only |
| `audit.prisma` | Tenant/acting-workspace audit and related resource snapshots |

The commented `deprecated-schema.prisma` stays historical and declares no models.
Do not reactivate it. No historical business migrations or seed are restored.
The separately approved `prisma/ddl` baseline installs native prerequisites and
storage write invariants, not a complete Prisma migration history.
Prisma v7 supports directory-based multi-file schemas without a preview flag:
[official schema location documentation](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/location).

## Domain Boundaries

### Identity and Recovery

`User.passwordHash` remains the first-party credential; username/email are the
existing account identifiers. `PasswordResetToken` is separate from access and
refresh tokens. Its email is a snapshot of the account address used for delivery;
reset verifies that this still equals the account's current normalized email.
Only a hash is stored, never a password, raw reset credential or OTP code.

Password recovery must conditionally consume an unexpired, unrevoked token,
change the password, revoke other outstanding reset tokens and revoke old sessions
in one transaction. A consumed token cannot be replayed. Generating/sending reset
mail requires throttling and a non-enumerating response; these are application
behaviors, not schema guarantees. An OIDC-only account must not gain a password
through an unreviewed reset policy. No phone or configurable IdP models are added.

### Material, Stock and Position

P07 (2026-10-18) adds required `Material.branch` using the `MaterialBranch`
enum (`consumable`, `chemical`, `biological`) and required JSON `attributes`.
Shared discriminated schemas validate a finite set of optional branch-wide
properties; this is not EAV, user-defined schemas or professional subtypes.
Workspace-flat `MaterialType` remains independent of the branch. Material and
classification codes are workspace-unique; names and external identifiers may
repeat across materials, while aliases/identifiers are unique per material.
Materials and classifications archive/restore, with no hard-delete route.
Existing instances prevent changing either the branch or quantity unit.
The P07 acceptance applied only these additions to the empty test Material table;
it did not synchronize development/production or the concurrent file schema.

The definition supplies the quantity unit; batches supply optional lot metadata;
instances supply identity, initial quantity, opening time and optional expiry.
`StockItem` supplies current quantity, availability state and optional custodian.
There is no second writable aggregate balance. Item count and remaining quantity
are different queries; a bottle with 10 mL is one item, not ten bottles.

An instance's effective expiry is its override, otherwise its batch expiry.
Expiry and task overdue are derived from timestamps and current lifecycle states,
not duplicate persisted status flags. The material unit must not change after
instances exist. MVP does not convert units or split a physical instance across
positions. Transfer moves a whole tracked instance; partial consumption changes
that instance's remaining quantity, not its ownership or physical identity.
Whole-container checkout can retain remaining quantity and change custody/state.
Return records the current quantity and destination, preserving any consumption.
Concrete issue/return policies must be validated by their use cases.

Nodes are CONTAINER or POSITION rather than a hard-coded four-level hierarchy.
Every stored item occupies a POSITION leaf, including ordinary shelf positions.
Box cells can use parent + row/column coordinates. Current `Placement` is unique
both by stock item and by position; old placements are recorded in journal lines,
not retained as competing active placement rows.

### Native Storage Tree

`StorageNode.path` is required `Unsupported("ltree")`; it is not a nullable
compatibility field or a second application-maintained string path. Each label
is the stable UUID without hyphens. A GiST index using `gist_ltree_ops` belongs
in the Prisma model. No redundant full-path B-tree unique index is needed:
the validated final label is already a globally unique node ID, and PostgreSQL
limits the size of a B-tree entry. See [PostgreSQL B-tree documentation](https://www.postgresql.org/docs/18/btree.html).

The foundation DDL installs only `ltree`. The post-schema DDL owns path creation,
immutable identity/topology, deferred final-state validation and atomic subtree
moves. Creation/deletion/structural changes serialize on the topology row. A move
locks that row before reading nodes, rejects positions/archived parents and
cycles, and rewrites all descendant paths in the caller's transaction. Renaming
does not rewrite paths. Same-topology foreign keys still express direct parentage.

The facility-local writer now joins an active managed DatabaseRuntime transaction
through its public capability port; it does not require a native TransactionClient
or introduce controllers, authorization, audit emission or inventory execution. Deferred
constraints must stay deferred while a subtree is rewritten. Native errors abort
the transaction; use-case retry policy remains unimplemented.

Current placements retain node IDs when their container moves. New journal lines
can capture `fromNodePathSnapshot` and `toNodePathSnapshot` as text, preserving
history independently of the mutable tree. Those nullable fields do not invent
paths for old history, and execution still must populate them when applicable.

Path consistency is not permission inheritance. There are no node-level grants,
inheritance switches or TypedSQL generators. I06 adds parameterized ancestor,
children and descendant reads with explicit SQL read ceilings, bounded keyset
cursors and the child-page index's unique id suffix. Its schema change has not
been applied to an existing database. See [I06](mvp-i06-2026-10-18.md) for current
interfaces and validation limits. The user confirmed that a future node may
explicitly stop inheriting parent grants; this does not introduce an explicit Deny rule.

### Approval and Workbench

The initial approval structure has one assigned approver and supports ISSUE and
TRANSFER, not a configurable workflow engine. Self-approval, approver selection,
withdrawal eligibility and resubmission policy remain use-case decisions.

Approval decision is distinct from execution. `InventoryTransaction` optionally
links the approved request through a unique tenant/workspace foreign key, so a
request cannot have two successful execution transactions. A unique
workspace/idempotency key plus request hash supports safe replay; it does not
make a non-transactional handler safe. A retry must compare the same canonical
payload before returning the original result.

Approval todos query requests; ordinary task completion cannot approve a request.
Workbench totals and lists query authorized domain facts. There is no writable
Workbench snapshot, aggregate KPI table, or fake equipment telemetry.

### Files, Alerts and Audit

`ResourceIdentity` is a stable cross-domain reference, not an authorization graph.
`FileReference.resourceId` references this identity; tasks and audit can use the same
reference boundary. Actual ownership and lifecycle remain in the concrete domain.
The I04 Authorization resolver will load business-target facts through domain-owned
providers; I05 Resource providers can reuse the same facts without duplicating ownership.
Authorization by a known business ID does not require a ResourceIdentity round trip.
The Resource core and material Provider implementation are recorded in
[`mvp-i05-resource-2026-10-18.md`](mvp-i05-resource-2026-10-18.md).
See the [current permission/context design](permission-authorization-2026-10-18.md).
This design clarification changes no Prisma fields and adds no node grants or inheritance model.

`FileObject` describes a bucket/key and verification lifecycle. `FileAsset`
describes a named upload. `FileReference` binds it to a real resource with a
module-defined `purposeKey`; it is not a generic file-type permission enum.
Unbound uploads are private to their uploader until authorized binding. Download
checks the current resource owner's permission, not merely the asset or object ID.
D10 (2026-10-18) does not offer reference restoration: unlinking retains reference
history and logically retires the asset, without reopening uploader access. Adding
the file again requires a new upload. One asset binds to one material in the first
release; the existing three-column unique constraint alone does not enforce this
cross-resource invariant. I08-B must serialize binding and cleanup and enforce it
under the shared object/asset locks. These are approved application rules, not
new schema fields or already implemented behavior. See the
[attachment contract](../../../../docs/product/mvp-attachment-contract.md).

I08-A (2026-10-18) adds `FileUploadSession` for single/multipart intent, expected
size/full SHA-256, provider upload ID, completion manifest, expiry, leases and
the completed asset. Unique organization/uploader/idempotency-key constraints
support replay; the completed asset relation includes organization consistency.
`FileObject.uploadSessionId/lastCleanupAt` and `FileAsset.unboundExpiresAt` are nullable
additions. Existing assets are not expired or deleted by a backfill. Reverse relations
on User/Organization add no columns. FileReference itself is unchanged.

File currently implements only unbound owner access, not the resource-authorized
binding/download requirements above. Candidates are copied to a different private
key and fully verified before atomic publication, with storage I/O outside the
database transaction. Cleanup and future binding must share FileObject -> FileAsset
locks and recheck lifecycle/references under those locks. Type detection and malware
scanning remain deferred. The [I08-A implementation record](mvp-i08a-2026-10-18.md)
documents APIs, retention and verification limits; this additive schema has not
been synchronized to an existing database.

Alerts cover low stock, impending/actual expiry and overdue tasks. A dedupe key
identifies the same source/rule; later recurrence reopens the alert and appends an
event rather than losing handling history. Ignoring an alert does not modify stock
or complete a task. Notification recipients have independent read states.

Actors reference global users so history survives leaving a workspace. Membership
and role checks happen at action time; a user foreign key is not proof of permission.
Business histories use restrictive deletes and lifecycle fields, not cascading
deletion. Journal, decision, maintenance and audit records are append-only by
application contract; these schemas do not install database immutability triggers.

## Database Guarantees and Service Requirements

Composite foreign keys include organization and, for workspace-owned chains,
workspace IDs. They reject cross-tenant and cross-workspace references along the
material/instance/stock/approval/stocktake chains. An instance's optional batch
must belong to the same material. A stocktake adjustment must reference a journal
line for the same stock item. Shared physical nodes only require the same
organization; facility access still needs authorization at execution time.

The service layer must also enforce:

- Nonnegative quantities/counts/file sizes, positive versions and valid precision;
  material units and Decimal(20, 6) bounds, with no floating-point arithmetic.
- Valid box coordinates and lifecycle policies; archived/occupied nodes cannot
  be repurposed. Native storage DDL enforces parent/path consistency and container
  parentage, but placement creation still must verify POSITION kind.
- State consistency: checked-out custody, depleted quantities, completed task
  metadata, invitation acceptance/expiry, verified uploads and approval decisions.
- Role scope matching its binding, active memberships and permission checks.
- Resolving business-target ownership from domain facts, comparing it against the
  request's expected scope, then authorizing. A supplied workspace ID, a resource
  foreign key or successful context resolution alone is not an access grant.
- `ResourceIdentity.kind` matching exactly one concrete owner, atomically created;
  workspace ownership is resolved from that owner for files, tasks and alerts.
- Execution matching the approved type, stock items, amounts and destinations;
  stock availability and facility access must be rechecked despite prior approval.
- One transaction for stock version checks/updates, placement changes, journal,
  audit and durable site notifications. Concurrent occupancy conflicts roll back
  the entire execution; locks or conditional writes prevent lost stock updates.
- Stocktake count completion and expected-version checks before confirmation;
  a difference produces an ADJUSTMENT line and updates current state atomically.
  Previously unknown objects go through registration/receipt, not orphan count rows.
- Permission-aware queries and exports, no cross-workspace material grants, sanitized
  audit details, and serialization of Decimal/BigInt at the API boundary.

Prisma schema syntax does not express all cross-row predicates, state machines,
CHECK constraints, or authorization policies. The approved native storage DDL
enforces only its stated tree invariants, not the whole business closure.
Quantity, placement, unit and authorization guards remain requirements of their
write slices. The MVP schema review documents the remaining enforcement gaps.

Native DDL execution order, explicit path backfill and existing-data precautions
are documented in [the DDL guide](../../prisma/ddl/README.md). Foundation DDL must
precede schema synchronization; tree invariants follow it. Do not silently apply
these scripts to existing environments or restore old business migration history.

## Scope Exclusions and Remaining Decisions

No telemetry, robot/vision commands, external synchronization, workflow engine,
inventory reservation, aggregate multi-position stock, custom material schemas,
cell culture/QC lineage, billing, file versions/online editing or generic job
platform is modeled. Standard exports need not introduce an export-job table.
Basic equipment records do not imply hardware capabilities or a mandatory UI.

Destructive retention policies, detailed issue/return rules and batch API atomicity
still need their own approved slices.
The existing seven identity/session tables retain scalar fields, defaults, native
types, unique constraints and relations. New reverse relations add no columns.

## Verification

Use an existing configured Prisma environment; an empty named environment is not
a valid source of connection variables, even for offline schema operations.

```powershell
pnpm --filter @talos-ark/backend prisma format --env dev.local
pnpm --filter @talos-ark/backend prisma validate --env dev.local
pnpm --filter @talos-ark/backend db:gen-client --env dev.local
pnpm --filter @talos-ark/backend build
```

Validation, formatting, client generation and schema-to-schema diff do not connect
to or mutate the database. Native DDL was additionally verified in disposable
PostgreSQL containers, never the existing development/production databases.
No repository test scripts are introduced or maintained.

In the initial schema-only iteration on 2026-10-08, formatting, validation, client generation, backend build and
`git diff --check` passed. An offline schema-to-schema SQL diff against the
pre-change schema reported 46 added tables, 109 new foreign keys, no changes to
the seven existing tables and no destructive statements. The diff used placeholder
connection URLs and was inspected in memory; no migration file was written and
no database was connected or synchronized. Business behavior was not tested.

In the subsequent storage-tree iteration, disposable PostgreSQL 18.6 databases
verified the foundation/post-schema DDL, creation, scalar rename, subtree/root
moves, rejection of cycles/cross-topology parents/path drift/identity changes,
serialized opposite concurrent moves, idempotent DDL reapplication, and legacy
adjacency backfill with rollback on cyclic data. The compiled Prisma writer was
exercised through the PG adapter. This is not full MVP end-to-end acceptance or
a benchmark of the deferred read/pagination functionality.

The offline diff for this iteration affects only StorageNode, MaterialType and
InventoryTransactionLine: it adds native path/GiST and nullable history snapshots,
and removes the approved classification hierarchy. No existing identity/session
columns change. Full review: [MVP schema readiness](../reviews/mvp-prisma-schema-2026-10-08.md).

For I08-A on 2026-10-18, offline format/validate/client generation, backend build,
targeted lint, 153 in-memory dependency assertions and 16 Nest/SDK-local assertions
passed. These are not live PostgreSQL/S3 concurrency or business-route evidence.
No db push, native DDL or real environment update was performed for this addition.
