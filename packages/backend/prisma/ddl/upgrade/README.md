# Database Upgrade Policy

This directory contains explicitly reviewed, operator-run changes.

`super-admin.sql` adds `User.isSuperAdmin` with a non-null `false` default. It
does not grant access to any account or synchronize other Prisma models. Apply
it only against the intended existing database, then regenerate the client:

```powershell
pnpm --filter @talos-ark/backend prisma db execute --file prisma/ddl/upgrade/super-admin.sql --env dev.local
pnpm --filter @talos-ark/backend db:gen-client --env dev.local
```

New databases receive the same field through ordinary schema synchronization.

`system-super-admin-approval.sql` removes the requester/approver inequality from
`ApprovalRequest_state_check`, enabling system-administrator self-review. It keeps
the positive-version and status/decidedAt constraints. Ordinary self-review remains
rejected by application authorization. Apply it together with the B02 application
update to the intended existing database:

```powershell
pnpm --filter @talos-ark/backend prisma db execute --file prisma/ddl/upgrade/system-super-admin-approval.sql --env dev.local
```

This upgrade changes no identity, membership, approval row or account privilege.
New databases receive the corrected constraint from `ddl/schema/approval.sql`
through the existing native-DDL initialization step. B02 verified this upgrade
only in an isolated PostgreSQL database; it was not applied to a shared database.

Upgrade tooling, version tracking, rollback and deployment policy remain undecided.
Nothing in this directory is automatically executed by `db:init` or application startup.

`background-job-telemetry.sql` adds nullable W3C source trace columns and the
status/availableAt/id index for bounded backlog observations. It does not rewrite
jobs, change retry semantics or place identity in the queue envelope. Apply before
deploying the updated generated client to an existing database:

```powershell
pnpm --filter @talos-ark/backend prisma db execute --file prisma/ddl/upgrade/background-job-telemetry.sql --env dev.local
pnpm --filter @talos-ark/backend db:gen-client --env dev.local
```

The script is idempotent, but regular index construction takes locks; assess a
maintenance window or separately reviewed concurrent-index procedure for a large
active table. New databases receive the same columns/index through ordinary
schema synchronization. The patch requires the I09 BackgroundJob table to exist;
if it is missing, review the generated Prisma diff and deploy the prerequisite
table first rather than using a full schema push implicitly.

After isolated idempotency verification, the user authorized upgrading dev.local
(talos-ark_backend_dev/public) on 2026-10-22. That database lacked BackgroundJob;
the inspected Prisma diff contained only its enum, table and four indexes. Those
objects were created in a transaction with lock/statement timeouts, then this patch
was applied and the client regenerated. Nullable column sizes, all five indexes
(including the primary key), unchanged business counts and an empty final Prisma
diff were verified. Test, production and shadow databases were not changed; no
task consumer or file-cleanup operation was activated.
