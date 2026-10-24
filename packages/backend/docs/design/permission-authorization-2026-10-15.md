# Permission and Authorization foundation

Historical implementation record, 2026-10-15. The current design and I04 business-target
resolver supplement are in [Permission and authorization design, 2026-10-18](permission-authorization-2026-10-18.md).
The interfaces and verification below describe the original foundation, not that supplement.

## Scope

This is the pre-P06 foundation, not completion of P06 member, invitation or role-management endpoints.
The existing P04 HTTP contracts and business rules remain unchanged. No schema, migration, initial
grant expansion, node inheritance, explicit Deny or arbitrary ABAC expression language is introduced.

## Responsibilities and dependencies

- `core/permission` owns permission definitions, scoped roles/bindings and Casbin evaluation.
- `core/authorization` resolves project-owned context facts, coordinates checks and projects query scopes.
- OrganizationContext and WorkspaceContext supply live membership/ownership facts, not authorization.
- Organization/Workspace application services retain owner-only creation, initial role content and audit.
- HTTP adapters bind the verified ALS actor; both core modules receive an explicit user subject.
- Dependency direction is application -> Authorization -> Permission, with independent context facts.
  Permission never imports Authorization, business modules or request ALS. Casbin stays internal.

## Interfaces

`PermissionKernel.evaluate` and `evaluateMany` accept a user subject, registered permission code and
structured organization/workspace scope. `definition` provides a validated registered definition;
`scopes` enumerates authorized scopes for a permission, optionally bounded by an organization or workspace.
Unknown permissions and incompatible scopes are configuration errors, not successful checks or empty fallbacks.
`parsePermissionCheck` constructs an immutable, runtime-validated check without granting anything.

`AuthorizationKernel.check` returns either an allowed current-operation context or a non-authorizing
reason (`context-unavailable` / `no-grant`). `require` preserves the existing non-disclosing team 403.
The subject and expected organization/workspace IDs are validated. Workspace facts must belong to
the specified organization and active organization membership. Returned context is not a reusable
credential, bearer token, or replacement for checking a later operation. Dependency failures propagate.

`scope` returns `none`, organization IDs, or organization/workspace pairs. Repositories must apply
these constraints before pagination/count/export. `none` means an empty predicate such as `id IN []`,
never an unrestricted `{}`. P04 intersects workspace access with organization-read access explicitly.
The planner supports only the finite domain-RBAC model implemented here; it is not a policy-to-SQL compiler.

## Casbin and persistence

The existing Permission, Role, RolePermission and scoped binding tables are the only durable policy source.
There is no separately writable `casbin_rule` table and no remote Casdoor enforcement.
The internal model uses exact domain and permission matches, `g(user, role, domain)` and allow-only effects.
Subjects/roles have distinct prefixes; UUIDs are canonicalized before exact matching, and a workspace
domain includes its organization ID. No role hierarchy,
wildcard, implicit owner bypass or organization-to-workspace grant inheritance is enabled.

Readers load only the relevant user's bindings and requested scopes, checking active memberships,
unarchived organization/workspace/role and the role's declared scope. Casbin performs the actual decision;
list scopes use that same evaluator and eligibility predicates. Batch checks group policy reads by subject.
Each evaluation owns a fresh Model and Enforcer; configuration text is shared, mutable policies are not.
The model is initialized during module startup. There is no cross-request policy/result cache to invalidate.

Standalone reads use RepeatableRead. Within an existing managed transaction, they join without changing
its isolation/options. All persistence uses DatabaseRuntime.queryClient. A revocation committed before
a new authorization snapshot is observed by that snapshot. Already executing transactions retain their
documented isolation semantics; revocation is not cancellation of in-flight work.

## Write primitives

PermissionKernel exposes `createRole`, `findRole`, `setRolePermissions`, `bindRole`, `unbindRole`
and explicit `synchronizeCatalog`. Writes require an ambient managed transaction and join with mandatory
propagation, so caught failures still mark that physical transaction rollback-only. These are trusted
internal primitives, not self-authorizing administrative endpoints. P06 must authorize and audit their use,
define who may delegate which permissions and enforce owner/member lifecycle rules in application services.

Role creation/replacement validates registered permission scope and explicitly materializes the requested
catalog entries. Full catalog synchronization is opt-in and never runs in Discovery/startup. It updates
current definition names, but does not delete historical catalog entries, roles or bindings. Unknown/stale
codes cannot be authorized. Catalog rows are written in stable code order to reduce competing lock orders.

Binding validates an active role and effective membership in the exact organization/workspace. Repeated
binding/unbinding is idempotent. Unbinding also permits cleanup of inactive bindings. Permission replacement
updates the parent Role row before replacing child rows: this serializes ReadCommitted writers and makes
conflicting older RepeatableRead/Serializable snapshots fail instead of merging permission sets. The module
does not retry transactions. Audit and other business writes remain in the caller's physical transaction.

## Migration and deferred work

The internal `organizationIds` / `workspaceIds` interface is replaced by Authorization.scope, and the
old WorkspaceContext.requireContext permission check becomes facts-only requireMembership. Existing P04
callers are migrated together. Core TODO placeholders superseded by real contracts/engine are removed.
Current uncommitted organization-context/workspace-context naming changes are preserved.

At delivery, P06 still owned the pending member/invitation lifecycle, delegation rules and management
HTTP/UI acceptance; its later completion is recorded in [P06](mvp-p06-2026-10-15.md).
The confirmed I04 supplement extends AuthorizationContextResolver with business-owned target facts;
P07 supplies the first concrete provider. This is separate from I05 ResourceIdentity/reference providers.
Node inheritance,
stop-inheritance, cross-request caching/versions, distributed invalidation and general query compilation
are not activated by this foundation. Extending the policy model must also extend the query-scope planner;
it must not silently broaden list visibility.

## Verification boundary

The implementation is checked with the backend build/typechecker, focused ESLint/Prettier, an actual
Casbin isolation probe and comparisons against P04 queries inside a PostgreSQL READ ONLY transaction.
Additional isolated checks exercise module wiring and write orchestration without changing business data.
No maintained test scripts, schema synchronization, migrations, real administrative endpoints, SMTP calls
or business data writes are part of this change. Synthetic write checks do not prove PostgreSQL concurrency;
physical concurrent role-management acceptance remains part of P06.

2026-10-15 results: backend build/typecheck, focused ESLint/Prettier and diff whitespace checks passed.
The real Casbin model probe passed six assertions covering nine decision cases; the isolated Nest/write
orchestration probe passed 133 assertions, and PostgreSQL read-only parity checks passed 29 assertions
over one existing account plus a nonexistent subject. Review found and fixed UUID-case mismatches;
mixed-case subjects/scopes/bindings now pass both synthetic and database-backed checks. These counts
are assertion totals, not independent business scenarios or completion of P06 acceptance.
