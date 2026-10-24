# Dataset Coverage

Implemented fixtures are distinct from schema-only or future business capabilities.

| Area | Implemented | Boundary |
| --- | --- | --- |
| Identity | Active/pending accounts, optional profiles, Argon2 credentials, activation, authentication, revoked/consumed recovery | No default superadmin, fabricated OIDC identity or fake session |
| Organization/workspace | Owners, two organizations/four workspaces, populated and empty scopes | No archive fixture without a normal write capability |
| Governance | Scoped roles, multiple bindings, archived role, ACTIVE/LEFT/rejoined memberships, multi-scope users, invitations and permission assertions | SUSPENDED is not manufactured without a supported entry |
| Material | Three branches, flat classifications, codes/null codes, Unicode, long names, archive, volume up to 10000 | Invalid payloads belong in validation/type-check inputs, not persisted illegal rows |
| Batch | UNKNOWN/NONE/DATED dates, archive, referenced/absent batches | No fabricated relations |
| Facility/topology | Management workspace, USE/MANAGE grants, disabled/archive, containers/positions, 2x3 grid, node states, empty subtree move and reorder | ltree remains database/module-owned |
| Inventory | Receipts, instances/stock/placements, expiry profiles, partial/full consume, zero adjustment, dispose and transfer | CHECKED_OUT/QUARANTINED and occupied subtree relocation are not covered |
| Approval | CONSUME/TRANSFER, pending/withdrawn/decided, mixed decisions, execute/abandon/revoke | Approval does not reserve inventory |
| File | Explicit local fixture + generated single/multipart upload, verification, bind, download and unbind | Root-confined hashed/snapshotted inputs; requires test buckets; no remote URL, type sniffing, antivirus or SVG |
| Derived facts | Resource identities, audits, transactions/lines, events, idempotency facts | Produced by operations, not synthetic table datasets |
| Ordinary tasks | Not implemented | Task/TaskEvent business writer is absent; BackgroundJob is a different capability |
| Stocktake | Not implemented | No normal business write entry |
| Alert/threshold/notification | Not implemented | Business write/delivery capabilities remain incomplete |
| Equipment/maintenance | Not implemented | Schema/TODO modules are not executable capabilities |

Database-only groups need no HTTP listener, external IAM, SMTP, KVS or queue. The
attachment group explicitly opts into S3. Future session/OIDC integration must declare
real signing/KVS/provider dependencies instead of inserting plausible-looking rows.
System-wide operator privileges are never a shortcut around missing authorization.
