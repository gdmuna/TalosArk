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
