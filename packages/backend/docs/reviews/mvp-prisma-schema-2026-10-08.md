# MVP Prisma Schema Readiness Review

Date: 2026-10-08. Reviewed all 17 domain schema files, the approved native DDL,
the facility writer, `docs/product/mvp-scope.md` and the confirmed business choices
in the current conversation. The review uses the pre-edit schema snapshot, not
unrelated working-tree changes, as its implementation baseline.

## Findings

These are persistence/readiness findings, not claims that currently absent
business APIs have already caused production incidents. Some need an explicit
product decision; others can be enforced by a domain writer without adding tables.

### P1: Account Identifier Comparison Is Not Consistent With Recovery Assumptions

Source: [identity.prisma](../../prisma/model/identity.prisma), lines 3-4 and 79;
the recovery design refers to the account's normalized email.

The username/email unique constraints use ordinary text. A disposable database
accepted both `CaseCheck` and `casecheck`, and both corresponding email addresses.
If login/recovery lowercases inputs, that can make different accounts ambiguous.
The database has no normalized identifier column or explicit case-insensitive
identity comparison rule. Case-sensitive usernames could be intentional, so this
is a decision/enforcement gap, not permission to rewrite existing identifiers.

Before first-party login/reset is released, choose one canonicalization policy
shared by registration, login, invitation and recovery, then enforce uniqueness
on that identity. Audit collisions before any existing-data migration. Do not
silently introduce accent-insensitive equivalence or provider-specific email
rewrites. No authentication columns were changed in this task.

### P1: Quantities And Versions Still Admit Invalid Values

Source: [inventory.prisma](../../prisma/model/inventory.prisma), lines 8 and 11;
[material.prisma](../../prisma/model/material.prisma), line 113; corresponding
stocktake, approval, threshold and file-size scalars.

Decimal/native integer types enforce representation limits, not the business
lower bounds. A direct Prisma update persisted a stock quantity of `-1` in the
isolated database. Versions can also be zero/negative, and related quantities,
counts and sizes do not have database CHECK constraints.

Before live writes, enforce the confirmed nonnegative/positive invariants in
their owning write paths and preferably reviewed domain-level CHECK DDL for
unambiguous scalar bounds. Keep Decimal arithmetic at the application boundary;
do not store binary floating-point calculations. A stock mutation must compare
and increment its version atomically, not merely carry a version field.

### P1: Placement Uniqueness Does Not Enforce POSITION Kind

Source: [inventory.prisma](../../prisma/model/inventory.prisma), lines 31-44;
[storage-node DDL](../../prisma/ddl/schema/storage-node.sql).

The unique foreign keys correctly prevent double occupancy and multiple current
locations. They do not reject placement into a CONTAINER. After committing the
tree, an independent Prisma placement insert into an existing container succeeded.
The node validation trigger prevents repurposing an already occupied node, but
is not fired by inserting into Placement; installation preflight is not an
ongoing placement validator.

The inventory placement writer must verify POSITION kind and usable lifecycle
state under the same topology/node lock used by structural edits. Alternatively,
add reviewed inventory-owned database enforcement. Avoid a check-then-insert race
against a concurrent node-kind change. This is not authorization inheritance.

### P1: Material Unit Can Change Under Existing Quantities

Source: [material.prisma](../../prisma/model/material.prisma), line 31;
[inventory.prisma](../../prisma/model/inventory.prisma), lines 79-81.

A direct Prisma update changed a material's unit from mL to g after its physical
instance and stock existed. Existing balances would then acquire a different
meaning without conversion. The journal's `unitSnapshot` preserves old events,
but does not protect the current balance or the instance's initial quantity.

The material writer must refuse unit changes once instances exist, synchronized
with instance creation so concurrent writes cannot bypass the check. This follows
the already confirmed no-unit-conversion MVP rule; it does not require a generic
unit-conversion framework.

### P2: Role Scope And Concrete Resource Ownership Need Enforcement

Source: [permission.prisma](../../prisma/model/permission.prisma), lines 14,
38-59; [resource.prisma](../../prisma/model/resource.prisma), lines 5-24.

Role bindings verify the organization, but their foreign keys do not ensure that
the role's scope matches the binding type. A ResourceIdentity's enum also does
not ensure one concrete owner with the matching kind; per-table unique relations
do not prohibit the same identity from appearing in different owner tables.
These observations come from schema/DDL inspection, not a reproduced incident.

Role assignment must validate scope and active membership. Resource creation must
create the identity and its correctly typed owner atomically, with one trusted
creation path. Leaving a workspace must invalidate derived access, not delete
historical user identities. Node inheritance remains explicitly deferred.

## Scope Coverage

Coverage means the persistence model can represent the intended facts. It does
not mean the services, authorization or frontend integration are implemented.

| MVP area | Model coverage | Gate before release |
| --- | --- | --- |
| M01 Identity/session | User, OIDC binding, reset credentials, sessions/token pairs | Canonical identity policy; atomic credential consumption and session revocation; first-party endpoints |
| M02 Organization/workspace/member | Owners, retained memberships, scoped invitations | Invite/accept/revoke rules; active member checks; initial role assignment policy |
| M03 Authorization | Allow-only permission catalog, roles/bindings, facility access | Role scope checks; node grants/inheritance are excluded from this task and still needed for the agreed node permissions |
| M04 Material | Flat classification, definitions, aliases, identifiers, attachments via resource | Frozen units; category/archive/edit rules; permission-aware registration |
| M05 Instance/stock | Individual instances, optional batch, quantity, custody/status/version | Nonnegative values; lifecycle/custody consistency; atomic version handling |
| M06 Facility/storage | Organization facility, workspace access, native topology paths and position identity | Placement-kind/lifecycle enforcement; installation ordering; occupied/archive policy |
| M07 Inventory journal | Receipt/issue/return/transfer/adjustment, idempotency, quantity/state/location snapshots | One transaction for balance/placement/journal/audit/notification; approved payload revalidation; applicable path snapshot capture |
| M08 Stocktake | Scopes, expected versions/quantities/locations, counts, linked adjustment lines | Freeze the participant set when opening; resolve concurrent changes before atomic confirmation |
| M09 Approval/task | Fixed approver, issue/transfer lines, decision events, ordinary tasks | Conditional state transitions; self-approval/withdrawal policy; execute only an eligible request |
| M10 Alert/notification | Thresholds, deduped alerts/events, independent recipient states | Real rule evaluation and recurrence; atomic notification creation; treating an alert does not modify its source |
| M11 Workbench/query | Existing facts can supply read projections; no second writable snapshot | Permission-aware queries and pagination are explicitly deferred, not implemented by these models |
| M12 Attachment/audit/export | File object/asset/binding, audit actors/resources/snapshots | Verified uploads, current owner permission on download, sanitized audit, authorized export; durable replay/retention policy |

There are still 53 models and one generated client. Workspace-exclusive materials,
optional batches, one physical instance per StockItem and one current placement
are structurally represented. Composite foreign keys preserve tenant/workspace
consistency along the main material/stock/approval/stocktake chains. Restrictive
business-history deletes and retained members preserve references.

Approval and execution remain distinct: approval does not create a reservation.
The unique approval-to-execution link prevents duplicate successful transactions,
but does not itself prove the request was approved or that the payload matched.
Those checks belong to the future execution transaction. Ordinary task completion
cannot replace approval. Overdue/expiry remain derived presentation states.

No new hardware, telemetry, robot control, dynamic workflow, shared material,
reservation, aggregate multi-position balance, billing or universal schema engine
is introduced. Equipment models represent manual registry/maintenance only.

## Changes Delivered In This Iteration

- Required native StorageNode path, scoped parent foreign key retained, GiST index.
- UUID-based path creation, deferred consistency validation and subtree mutation
  serialized through a topology lock. No normal-name-dependent path rewrites.
- Facility-local transactional creation/move writer, not public business APIs.
- Independent extension foundation, post-schema invariants, explicit existing-tree
  backfill with rollback rather than database reset.
- User-approved flat MaterialType; no category or Material IDs are removed.
- Nullable journal path snapshots; no fabricated historical backfill.
- Removal of the stale seed configuration; no seed or historical migrations restored.

Native DDL is not complete Prisma migration history. For a durable deployment,
establish a reviewed business migration baseline before promising reproducible
production upgrades. Do not mix an extension-only migration directory with
`db:push` and assume it replays the whole MVP schema.

## Verification And Limits

- Prisma format, validate and client generation; backend/contract build.
- Offline before/after schema diff limited to the three intentional model changes.
- Disposable PostgreSQL 18.6: foundation and model creation, DDL reapplication,
  path generation, subtree/root moves, rejection of cycles, invalid parent kind,
  cross-topology parent, parent-only path drift and mutable node identity.
- Two concurrent opposite moves: first commits, second observes the new structure
  and rejects the cycle instead of committing inconsistent parent/path data.
- Legacy adjacency tree: paths backfilled; cyclic input rejects the upgrade and
  rolls back even the new column, without partially upgrading that database.
- Compiled Prisma PG-adapter writer: creation and move exercised in a caller
  transaction; normal scalar rename remains available in Prisma 7.10.
- Isolated reproduction of case-only account duplicates, negative stock,
  CONTAINER occupancy and material-unit mutation described above.

These are ad hoc checks, not newly added or maintained test scripts. Existing
development/production databases were not synchronized. Temporary containers
were stopped after verification. There was no full MVP end-to-end acceptance,
read/pagination benchmark, permission-inheritance test or production deployment.

## Conclusion

The domain schema is a viable starting point for the software MVP and does not
need another speculative family of tables before the first business slice.
It is not yet safe to declare MVP persistence ready merely because Prisma
validation succeeds. Resolve the findings' enforcement/decision gates as their
owning write slices are implemented; subsequently implement the explicitly
deferred node authorization and read/pagination capabilities.
