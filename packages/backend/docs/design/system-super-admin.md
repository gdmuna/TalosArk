# System Administrator Access

`User.isSuperAdmin` is an operator-managed, account-level authorization override.
It defaults to `false`; usernames, organization ownership, OIDC claims, request
bodies and ordinary role management cannot enable it. No HTTP grant endpoint is
provided. The authenticated local user ID is still required for every operation.

SystemAccessKernel reads the flag from the current database transaction. There
is no JWT copy or cross-request allow cache. Revocation takes effect for the next
authorization snapshot; an already executing transaction can retain its snapshot.

PermissionKernel permits registered actions and returns active organization and
workspace scopes for system administrators, respecting a caller's explicit
scope restriction. Authorization still resolves the actual target and checks its
organization/workspace pair and availability. Organization and workspace access
contexts allow administrators without manufacturing membership rows or claiming
ownership; ordinary requireMembership remains facts-only. Owner-gated governance
and capability projections explicitly recognize system administrators.

Authentication, CSRF/session protection, permission-definition validation, archived
contexts, resource ownership facts, business-state rules, idempotency identity,
upload-session ownership, quantity invariants, transactions and business audit are
unchanged. Workspace-to-facility storage eligibility remains a business constraint,
even when the actor is a system administrator. Unsupported APIs do not become
implemented through this override.

## Operator Commands

After applying the additive schema change described in `prisma/ddl/upgrade`, use
the exact local account ID and case-sensitive username. The command changes only
the named account, prints its ID/username/result, and never prints credentials:

```powershell
pnpm --filter @talos-ark/backend auth:super-admin --env dev.local --user-id <uuid> --username admin --grant
pnpm --filter @talos-ark/backend auth:super-admin --env dev.local --user-id <uuid> --username admin --revoke
```

The command is a privileged database operation. It does not grant this ability
to organization owners or ordinary account/profile APIs. Preserve its output in
the operator's execution record. Existing business audit remains organization
scoped; this change does not introduce a global security-audit service.

System-administrator business acceptance and ordinary-role authorization acceptance
are separate. This override does not repair missing permissions on old roles.

## Local Verification (2026-10-19)

- Applied only the additive field DDL to `dev.local`, generated the client, and
  granted the previously identified local `admin` account using both its UUID
  and username. No business-role grants were modified.
- Backend type checking, production build and scoped source lint passed. The
  operator script is outside ESLint's configured source scope; the compiler
  includes it.
- Real database probes passed for administrator allow, restricted scope listing,
  nonexistent target/identity denial and unknown permission rejection. A temporary
  revocation inside a rolled-back transaction restored the ordinary role's denial;
  the committed administrator flag remained enabled afterward.
- The existing browser session received inventory context HTTP 200 with all
  inventory capabilities enabled. No login/token replacement was required.
- Initial verification found independent Prisma P2022 failures in material and
  inventory reads. A subsequent same-day access repair upgraded the empty local
  business tables and installed the existing native constraints. Material,
  inventory, transaction, facility and workspace-detail reads now return HTTP 200
  in the existing browser session, including after a full reload. Existing account,
  organization, role and audit counts were preserved. No business form was submitted.
  See the frontend R04 `access-repair-2026-10-19.md` record for execution details,
  screenshots and the remaining unimplemented management services.
