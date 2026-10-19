# Database Upgrade Policy

This directory contains explicitly reviewed, operator-run additive changes.

`super-admin.sql` adds `User.isSuperAdmin` with a non-null `false` default. It
does not grant access to any account or synchronize other Prisma models. Apply
it only against the intended existing database, then regenerate the client:

```powershell
pnpm --filter @talos-ark/backend prisma db execute --file prisma/ddl/upgrade/super-admin.sql --env dev.local
pnpm --filter @talos-ark/backend db:gen-client --env dev.local
```

New databases receive the same field through ordinary schema synchronization.

Upgrade tooling, version tracking, rollback and deployment policy remain undecided.
Nothing in this directory is automatically executed by `db:init` or application startup.
