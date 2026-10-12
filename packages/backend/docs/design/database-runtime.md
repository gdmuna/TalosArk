# Database runtime and transaction context

## Scope

DatabaseRuntime replaces the internal PrismaService entry point. DatabaseModule
exports only DatabaseRuntime; the native DatabaseClient and transaction manager
are shared singleton providers owned by that module. DatabaseClient owns one
native PrismaClient and its managed query extension, using the existing PrismaPg
pool settings, query events and slow thresholds. Startup now performs SELECT 1
before emitting the connected event: PrismaPg initializes its pool lazily.
The generated Prisma client, schema, DDL and CLI are unchanged.

This is a breaking internal source/import change without a compatibility facade.
Public HTTP shapes and the existing Access business decisions remain unchanged.
Recognized Identity conflicts previously suppressed by an operation label now
return their specific domain error instead of falling through to a generic error.
The retired database/prisma nesting, generic repository placeholder
and Core transaction skeleton have been removed. No workflow, savepoint or
automatic transaction retry has been added.

## Public entry

```ts
database.client;
database.queryClient;
database.transaction.run(work, options);
database.transaction.current();
database.transaction.afterCommit(callback);
```

- `client` exposes the native root PrismaClient. It deliberately bypasses ALS;
  reserve it for explicit technical operations, not ordinary business queries.
- `queryClient` is a context-aware managed query view. Its type is derived from
  the actual query-only extension with lifecycle/extension/transaction controls
  omitted. Managed root and transaction clients satisfy it without casts or method
  forwarding; model select/include/omit inference is preserved.
- Managed queries normalize recognized SDK failures automatically. The query
  extension calls query(args), never a root delegate that would leave the current
  transaction. Transaction start/commit failures and lifecycle failures are handled
  separately inside the database module. The public execute wrapper is removed.
- `transaction` exposes only run/current/afterCommit in its public TypeScript
  interface. Internal context and client resolution are not part of that interface.

Query views are TypeScript contracts, not runtime security sandboxes: the actual
objects are still native Prisma objects. Do not cast around the view or cache a
client/delegate/PrismaPromise across transaction boundaries. Resolve queryClient
when creating each operation. Await all work inside a transaction; no detached
background tasks may rely on it staying active.
Do not issue manual BEGIN/COMMIT/ROLLBACK through managed raw queries; transaction
control belongs to transaction.run. The native escape hatch is not covered by
managed-query normalization or rollback-only tracking.

## Error ownership

The database normalizer accepts recognized Prisma and DriverAdapterError instances
only. Driver-adapter-utils is a direct dependency, not an implicitly imported
transitive package. Known ORM and raw-query failures share the same classification;
PostgreSQL 23505 is a unique constraint, 40001/40P01 a transaction conflict, and
recognized connection failures are unavailable. Unknown values and Prisma input
validation errors retain their identity. Already normalized errors are idempotent.

Failure metadata distinguishes the Prisma model from the actual driver table, and
retains constraint/field/SQLSTATE information when supplied. Missing facts are not
inferred from an operation name or parsed from error-message text. SDK details
remain internal and the original error is retained as cause.

Identity's domain-level mapper recognizes User username/email and ExternalIdentity
issuer/subject constraints, prioritizing the actual table over the Prisma model.
It no longer accepts a user/identity operation label. Its explicit owner-local
composeErrorMappers list applies the first recognized mapping once; unknown errors
and existing IdentityError instances pass through unchanged. Composition copies
its list, does not walk causes, register globals or hide mapper programming errors.
Business code calls identityErrors.run around its domain exit, not database.execute.
Nested writes retain their current input shape and atomicity.

## Propagation and options

| Mode               | No existing scope                         | Existing active scope              |
| ------------------ | ----------------------------------------- | ---------------------------------- |
| required (default) | Open a native transaction                 | Join it                            |
| mandatory          | Reject with database-transaction.required | Join it                            |
| requiresNew        | Open a native transaction                 | Open another transaction and scope |

requiresNew uses the private root client, never the parent's transaction client.
Only the executing async branch switches to the child; the parent connection,
locks and timeout remain in effect. Returning restores the parent's ALS scope.
Child failure does not automatically mark the parent rollback-only, but an
uncaught child failure still causes the outer callback to fail. Child commit
survives a later parent rollback.

The child cannot read the parent's uncommitted records. Accessing parent-held
locks can form an application wait cycle, and each child needs another pool
connection. Whether a parent later reads child changes depends on its isolation
level. Independent commit must be explicit in a Kernel's business contract;
default atomic Kernel operations should remain composable through required.

maxWait/timeout default to 2000/5000 ms, matching the installed Prisma defaults.
Isolation is left unspecified unless requested, preserving the database default.
Explicit options in a joined call must equal the outer declared options: joining
cannot change its isolation or reset its budget. If the outer isolation was not
declared, a joined explicit isolation is rejected rather than guessing what the
database default is. Invalid propagation, nonpositive/noninteger budgets and
unknown isolation values are rejected before business work starts.

Joined run resolves the callback result, not an independent commit. New physical
run resolves only after commit confirmation and its best-effort hooks complete.
A later commit failure can invalidate a result returned earlier by a joined run.

## Lifecycle and rollback-only

Each physical transaction gets a monotonic ULID and an independent ALS scope/client
binding in a private WeakMap. Scope metadata contains no Prisma object or request
metadata. Request ALS remains independent, including in after-commit callbacks.

Scopes progress from active to finishing to closed (timeouts close them directly).
They stop accepting queries as soon as the native callback finishes, the outer
transaction promise fails, or the monotonic timeout budget expires. Each physical
scope owns one expiry timer; client resolution also checks its deadline in case
the event loop has delayed timer delivery. This does not cancel arbitrary
JavaScript work: Prisma may still wait for a pending callback before run rejects,
but that callback can no longer query/register hooks/open a child transaction.
Closed/unbound ambient scopes reject; they never select the root as a fallback.
current returns a frozen scalar snapshot, including retained closed-scope state
when a detached async resource still references it. outcome=unconfirmed means
commit was not confirmed, not proof of rollback; connection loss at commit must
not trigger an automatic replay.

Failure escaping a joined managed run marks its physical scope rollback-only and
retains the first cause. Catching that error cannot make the owner commit. This
also happens at a recognized managed-query execution failure, before any domain
mapping or catch in business code. PostgreSQL can abort a transaction after a SQL
error and respond to COMMIT with rollback; a resolved native Promise alone is not
enough if that failure was swallowed. The query extension prevents that path from
being treated as a successful managed commit or triggering afterCommit.

Prisma input validation, missing-record control flow and arbitrary business errors
caught inside the same callback are not inferred to be failed SQL execution.
Failure escaping a joined run still poisons the outer scope as above. Expected
business outcomes should be explicit return values; local SQL-failure recovery
would require a separately designed savepoint protocol. Validation failures before
the joined callback starts do not poison the outer scope.

## After commit

Registration requires an active scope. Joined calls register against the outer
physical transaction; independent children register against their own transaction.
Rollback, commit failure or timeout discards hooks. Confirmed commit closes the
scope and removes its binding before hooks execute, sequentially, with database
ALS cleared. A child hook does not accidentally join the suspended parent.

Hook failures are logged with transactionId and safe err serialization; subsequent
hooks still execute and the committed business result is retained. If the
diagnostic logger itself fails, a fixed stderr fallback is attempted without
rethrowing a failure after commit. These hooks
cannot be relied upon for durable delivery and have no separately configured
deadline. Critical work belongs in a transactionally persisted Outbox. Never wait
inside a transaction for its own after-commit callback, or capture its raw client
for use inside that callback.

## Migration and verification boundary

Access and Identity now inject DatabaseRuntime and obtain queries through its
query view. RT rotation retains the same Session row lock, state re-read,
conditional RT consumption, generation update and ReadCommitted policy. Offset
pagination retains its two ordered reads in one transaction; cursor pagination
retains its existing comparisons and ordering.

Repository test scripts are not maintained in this iteration. The historical
access-pagination fixture still mocks the retired PrismaService surface (and
lacks the existing execute wrapper); it is not current verification evidence.
Verification uses disposable one-off checks, not schema synchronization or a
production database.

### Verified on 2026-10-12

One-off checks used the compiled implementation and an isolated PostgreSQL
18.6 container, with synthetic records and temporary probe tables only:

- required/mandatory share a physical transaction and connection; root queries
  cannot see its uncommitted writes. afterCommit observes committed data with
  database ALS cleared and request ALS retained.
- Swallowed joined failures prevent commit and retain the first cause.
  requiresNew uses a separate connection, restores its parent, owns its hooks,
  and survives a later parent rollback. A caught child failure does not poison
  the parent.
- Caught ORM/raw SQL failures also mark rollback-only before domain conversion;
  the transaction rejects, previous writes roll back and hooks are discarded.
  Prisma validation and findUniqueOrThrow missing-record recovery do not by
  themselves poison a transaction. ULIDs are unique and ordered within a manager.
- Joined option conflicts reject before work without marking rollback-only.
  Missing bindings and detached closed scopes reject rather than selecting root.
  Twenty concurrent transactions keep distinct, stable context IDs.
- A pending JavaScript callback after native timeout cannot query, register
  hooks or open child transactions. This finding required the explicit expiry
  timer and monotonic deadline checks; arbitrary JavaScript is not cancelled.
- Deferred foreign-key commit failure discards hooks. Hook and diagnostic-sink
  failures preserve the committed result and allow later hooks to execute.
- Actual Identity create/read/external binding keeps password omission and
  conflict mapping. Eight competing Access RT rotations produce exactly one
  winner; old AT validity, revocation and idle expiry remain unchanged. Offset
  and bidirectional cursor pagination return the expected rows. These callers
  join an explicitly ReadCommitted outer transaction and roll back together.
- Nested user creation with a duplicate external binding returns identity-conflict;
  external binding creation with a duplicate nested user returns user-conflict.
  Failed nested writes leave no partial records. Managed ORM/raw duplicates retain
  the constraint, actual table and SQLSTATE; native client calls still expose SDK
  errors. Unknown values, unowned constraints and existing domain errors preserve
  identity. Mapper composition applies only one matching rule and snapshots its list.
- An unreachable database rejects initialization, managed raw queries and transaction
  opening as unavailable, runs no transaction work, and emits no connected event.
- Nest composition importing DatabaseModule through two consumers retains one
  runtime/client/context and connects/disconnects exactly once. Public query types
  accept managed root and managed transaction clients, preserve select/omit inference,
  and hide transaction/lifecycle controls. The retired execute and conflict parameter
  are rejected statically. The actual pretty worker loads the relocated adapter,
  keeps English summaries and structured fields, and omits requestId from headers.
- The backend build, scoped ESLint, source/new-design formatting and diff whitespace
  checks passed. The two historical design documents updated only for naming/path
  changes retain their pre-existing formatter warnings; unrelated formatting was
  not rewritten.

No production/development database, schema synchronization, migration or external
identity provider was involved. These checks do not establish durable hook
delivery, distributed transactions, crash recovery, or hardware-dependent behavior.
The current generator does not enable typedSql. Its existing validation error is
preserved; successful TypedSQL execution through the extension has not been
verified and must be checked when that feature is enabled. No generated client or
schema feature flag was changed merely to obtain verification.
