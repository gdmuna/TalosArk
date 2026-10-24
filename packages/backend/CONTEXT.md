# Backend context

packages/backend is TalosArk's NestJS backend package. This document is the
local source of truth for its architectural boundaries and reset state;
repository-wide routing lives in the root CONTEXT-MAP.md.

## Current reset state

The package is intentionally in a structure-first phase:

- Deprecated business implementations, the former file system, their paired
  tests, historical Prisma migrations, and the seed script have been removed.
- prisma/schema.prisma contains the generator and datasource; prisma/model/*.prisma
  contains domain-owned models. prisma.config.ts loads the prisma directory.
  Development schema
  synchronization uses pnpm db:push. The approved native DDL under prisma/ddl
  installs database prerequisites before synchronization and storage-tree
  invariants afterward; it is not a replayable Prisma business migration history.
  Do not recreate historical migrations or the removed legacy seed. The approved
  development/test seed tool is a new, business-backed implementation described below.
- Most files in the new core, modules, platform, and future Infra areas are
  TODO-only seams. A directory or class is not evidence that its runtime
  behavior exists. main.ts, bootstrap/composition/app.module.ts, and
  bootstrap/bootstrap.ts are the real process and Nest runtime baseline;
  they do not imply that a business
  vertical slice is already available.
- Generic technical adapters that map cleanly to the target architecture remain
  real code: Prisma, Casdoor OIDC/Casdoor control-plane access, SMTP, ALS,
  logging, and typed configuration.

Do not turn TODO seams into implementations without an approved vertical slice.
Do not restore a removed legacy module merely to make an old route work.

## Database CLI

Executable backend tooling lives under `tooling/`, including the release workflow
helpers that CI calls directly. The former `scripts/` directory is no longer an
execution namespace. `tooling/cli`
owns input completion, environment catalogs, process forwarding and command
registration. Direct package aliases such as `pnpm prisma`, `pnpm seed` and
`pnpm storage:check` reuse those modules; `pnpm tool` is the discovery entry.

The `pnpm prisma` wrapper uses Commander for wrapper arguments and Inquirer Select
for environment selection. Explicit `--env`/`--env-file` selectors remain valid;
without one, interactive terminals choose from Prisma-only files in ops/prisma/env.
CI/non-interactive calls must select explicitly; there is no implicit dev fallback.
`pnpm db:init` runs only prisma/ddl/init SQL against the selected primary database,
and db:prepare remains an alias. It never synchronizes business tables or applies
upgrade scripts. CLI usage and initialization limits live in ops/prisma/README.md.

## Development/test seeding

`pnpm db:seed` runs pure `list`/`plan` directly from source; database-only
`init`/`status`/`report` also avoid Nest compilation. Only `apply`/`verify`/`resume`
prepare `tooling/seed` in isolated `.cache/seed/`, not Nest's dist. CLI and SDK share
SeedApplication.list/plan/run. Dataset definitions
and deterministic factories are pure; groups compose ordered datasets and pass typed
output references to later inputs. Tags select independent datasets without resolving
dependencies. Business seeders call existing application services, preserving actor,
authorization, resource, audit, topology and inventory rules. `tooling/seed/runtime/seed.module.ts` is a
dedicated composition root without AppModule, HTTP/WS listeners, IAM, mail, S3, KVS
or queue connections by default. An attachment integration group explicitly opts into
S3 using an explicit storage-only JSON or runtime profile read into an isolated object.
Only capabilities selected by the sealed plan are loaded; pure definitions never import
Nest/runtime classes. MaterialCatalogModule separates catalog/batch capabilities
from attachment infrastructure; ordinary MaterialModule composes both as before.

Without an existing actor, groups can provision real local credentials and scopes.
Governance compositions cover accounts, profiles, organizations, workspaces, roles,
membership and invitation lifecycles, including explicit negative authorization checks.
Local credentials live in IdentityCredentialModule so tooling does not need external
IAM or KVS. Organization invitations use a small delivery port: normal application
composition keeps SMTP delivery; seed saves its local inbox to an explicit private
JSON after commit. This callback is not a durable transactional mail outbox.
Credentials are random, plaintext and incrementally saved to that file, without
encryption or key management. Prepared accounts are distinguished from committed
receipts; resume loads the original namespace/fingerprint-bound file.
Groups may instead use an existing actor and organization/workspace pair without repairing
grants. `init` creates/upgrades only the tool-owned `seed` execution metadata;
historical `seed.target` markers remain untouched but are no longer required or
bound to database OIDs/login roles. Apply/verify/resume retain explicit database-name
confirmation, a session advisory lock and per-kind declarative database readiness
checks before loading runtime providers. Pure contributions own required tables,
extensions, constraints, triggers and function signatures; the checker contains no
business-kind branches and never repairs DDL. Production profiles and
NODE_ENV=production reject. These guards do not prove an arbitrary database has no
production data. The Prisma wrapper remains DB-only.

One session advisory lock serializes seed commands per database. Each bounded business
operation and its receipt commit in the same managed transaction. External file workflows
explicitly retain their own transactions; file publication and the seed receipt are not
atomic. Explicit external intents retain stable upload keys and checkpoints;
failures still require inspection/normal file cleanup. Final snapshots are taken
after all scenario mutations and sealed with completion in one transaction.
Completed plans reverify these final snapshots on reuse;
changed content, parameters, scope, actor or versions fail
instead of overwriting. Failed/interrupted runs retain committed receipts. Explicit
resume is limited to opted-in account/workspace/material/batch/attachment mutation
handlers, matching plans and confirmed existing facts/credentials; other mutation
handlers reject replay. Read-only assertions rerun after recovery reaches them.
Execution-version-1 history stays inspectable but is not adopted as resumable.
The tool stops new operations on cancellation, reports unknown outcomes separately,
and keeps execution, export and cleanup failures distinct. Status/report commands
inspect/re-export tool metadata without replay. There is no automatic cleanup,
reset or blanket rollback. Reference
dates control generated content, never the real business clock. Usage, extension
examples and validation boundaries live in tooling/seed/README.md; coverage.md distinguishes
implemented fixtures from unavailable business capabilities. Data/parameter/output types
derive from contracts or kernel inputs, with NoInfer-pinned bindings and a dedicated
seed:typecheck CI job. Runtime validation remains necessary for semantic constraints.
Manifest format 3 includes explicit dependencies and local-file size/SHA-256 facts;
old namespaces are rejected without adoption or deletion. Local fixture inputs are
bounded, root-confined and privately snapshotted before writes; uploads use those
snapshots through normal business APIs. Fingerprints do not provide recovery or
atomicity across external storage. Definition/group/runtime ownership and commands
are documented in the seed README. Explicit assertion kinds reuse the same
dataset/step/handler pipeline, run in short read-only transactions and have no
receipts. The inventory-regression group compares authored quantity/status/position
expectations using only referenced IDs and their exact organization/workspace.
Assertions do not auto-join demo/volume plans or replace receipt drift checks.
Verify reruns them; recovery prechecks defer final assertions until replay.
Failed assertions retain prior business writes without completing the run.

## Current iteration policy

The backend is in a rapid-iteration phase. Do not add, backfill, or maintain
test scripts unless the user explicitly requests them.

## HTTP request identity

HTTP request authentication uses the Platform-owned RequestAuthentication snapshot
(`request.authentication`: userId/sessionId), not raw JWT claims or Identity SDK types.
Bootstrap decorates each request with null; AuthGuard binds a frozen snapshot only
after successful Session token verification. Public/optional authentication behavior and
wire shapes are unchanged. AuthGuard also binds the verified user into request ALS;
AlsContextAdapter.requireActor returns a frozen userId-only snapshot and rejects
missing identity. Metadata cannot supply an actor. The existing allowlisted
response context.userId is now populated for authenticated requests; session IDs
and raw claims are not projected there.

## Organization and workspace (P04)

OrganizationModule composes atomic organization creation, initial effective
membership/organization grants, WorkspaceModule's public creation capability
and two audit records. WorkspaceService joins the ambient DatabaseRuntime
transaction; audit failures roll back the whole operation. No account ID comes
from the request body: application services consume the verified ALS actor.

OrganizationContextKernel validates effective organization membership. PermissionKernel
evaluates transaction-local allow-only binding snapshots with internal Casbin and explicit
ORGANIZATION/WORKSPACE scope. WorkspaceContextKernel supplies facts for the organization/workspace
pair and effective workspace membership. Owners have no implicit workspace access:
P04 creation also requires a current organization grant, and entry requires both
organization and workspace read grants. Read snapshots use RepeatableRead.

P06 adds organization-owned member, invitation and custom-role HTTP/application
services and Web management views. Owners explicitly initialize governance once;
reads never repair grants. Workspace managers may only delegate held permissions
inside their scope. Invitations target existing normalized-email accounts, expire,
rotate on resend and are accepted once under the same organization row lock used
by management writes. Audit joins the write transaction; bounded SMTP delivery is
queued only after commit, with no retry or durability promise. Removed members and
bindings lose access on the next authorization snapshot; historical membership rows
remain. See docs/design/mvp-p06-2026-10-15.md for rules and verification limits.

R03 management details reuse those P06 capabilities rather than creating a second
management authorization layer. TeamDetailService and WorkspaceManagementService
provide scoped workspace/member/role reads, independent relationship and activity
pagination, safe audit projections, workspace updates and role revision checks.
The services authorize before search/count/pagination and preserve canonical
OrganizationMember IDs. Material counts and four-week creation aggregates come
from the P07 material reader; facilities, inventory and equipment remain outside
this slice. See the dated frontend R03 record for the remaining browser and
real-session verification limits.

Initial permissions/roles are explicit business writes, not startup Discovery or
automatic remote Casbin synchronization. I03 now supplies code-definition assembly;
P06 verifies the bounded Web member/invitation/role workflow, not future resource
or facility-node authorization. Wire contracts
live in contracts/team; unknown/unavailable organization contexts share a non-disclosing 403. See docs/design/mvp-p04-2026-10-15.md for exact boundaries and evidence.

## Team governance

Team governance determines whether an effective organization member may manage
organization members, edit role definitions, manage invitations, or manage members
inside a particular workspace. Organization ownership and an explicit governance
grant are both required for organization governance. Workspace entry and workspace
governance are separate qualifications; organization governance does not grant
workspace entry. Editing a role definition is distinct from assigning roles to a member.

## Organization write coordination

OrganizationWriteKernel coordinates the MVP organization-scoped write protocol:
a managed ReadCommitted transaction, an active organization row lock, an explicit
authorize callback, then an execute callback receiving its authorization result.
Team management, material/classification writes, workspace creation and workspace
updates share this entry. Existing transactions must explicitly use ReadCommitted;
OrganizationService declares it so first-workspace creation joins the same physical
transaction. Incompatible outer options reject before either callback runs.

TeamOperations adds the verified actor and effective membership check inside the
lock. Invitation acceptance has a named entry with token revalidation instead of
an existing-membership requirement. Target state, role delegation, conditional
writes and audit content remain business-owned; AuditKernel's mandatory boundary
retains transaction enforcement. The coordinator guarantees ordering, not the
semantic completeness of user-provided callbacks or that every successful no-op
must produce an audit event.

FilePurposeProvider management authorization remains a composition exception:
File owns its ambient write transaction and subsequent file locking; Material's
provider keeps the organization then material lock before returning authorization
facts. It does not use the complete-use-case coordinator for an authorization-only
callback. Both paths retain the same MVP organization lock and must be considered
by the required pre-1.0 concurrency redesign. See
docs/design/organization-write-protocol-2026-10-19.md for scope and verification.

## Materials and resource references (P07)

MaterialModule provides real workspace-scoped material/classification reads and
writes, three coarse branches and finite optional branch attributes. Shared
contracts validate both input and explicit output projections; JSON attributes
are not a custom-schema or specialized-subtype mechanism. Codes are unique within
a workspace, while names and external identifiers may repeat between materials.
Archive/restore retains history; existing instances freeze branch and quantity unit.

Material writes acquire the organization row lock before checking both material
read and mutation permissions, then update the material, ResourceIdentity and audit
in one managed transaction. This coarse serialization is accepted only for MVP;
finer concurrency control is required before 1.0, as recorded in the foundation
work plan. The TODO-only Lock Core does not yet provide this capability.
Lists apply authorization before pagination/counts; direct detail/resource reads
resolve the real material scope. The target and resource providers share the
public facts reader, not permission evaluation or a recursive resource lookup.
ResourceProviderRegistry freezes discovered providers once; ResourceKernel creation
requires a registered kind and an ambient transaction.

Composition configures permissions only when a workspace-manager role is first
created. Reused existing roles, including those bound to newly created workspaces,
keep their existing grants; P06 must explicitly bind any additional material role.
No read/startup path repairs grants. P07 does not activate inventory, attachments,
QC or culture. Real test-database service acceptance and synthetic-HTTP browser
acceptance, not full live Web end-to-end acceptance, are recorded in
docs/design/mvp-p07-2026-10-18.md.

## Optional business codes

Material, MaterialType, Facility, StorageNode, MaterialInstance and the Equipment
schema have nullable business codes. They are user-owned labels, not system IDs:
missing, empty and whitespace-only input stores null; no UUID or INS fallback is
generated. Existing nonempty codes and their scoped uniqueness remain. Update
omission preserves a code; explicit null or blank clears it where code editing
already exists. MaterialInstance still retains its existing immutable-code rule.
ApprovalLine.codeSnapshot preserves the nullable event-time fact. Read contracts
require the code property and accept null; they do not fabricate a label as a code.
Resource/audit labels and location paths use existing names when codes are absent.
After schema synchronization, reapply prisma/ddl/schema/storage-node.sql: its move
function now accepts null as the new code, while the writer resolves omitted codes
to the existing value. Manufacturer batch numbers, catalog/external identifiers
and permission codes are not part of this optional-label policy.

## Business audit

core/audit exports AuditModule, AuditKernel, SDK-free contracts and AuditError.
Business modules import AuditModule explicitly when their approved use case needs
it; no management routes are activated by I02. record requires an ambient managed
database transaction and puts validation plus append inside mandatory propagation.
Caught audit failures therefore mark that business transaction rollback-only.
Receipts are provisional until the outer commit. The private concrete repository
uses existing AuditEvent/AuditResourceReference models with composite-FK organization
checks and event-time label snapshots; it is not a separate Infra Port.

The application chooses safe detail fields and supplies a verified actor plus an
authorized organization/workspace. Core does not inspect request ALS or infer
authorization. Details are bounded plain JSON snapshots, never automatic request
or entity capture. list requires an explicit organization or workspace scope and
uses filter-bound (occurredAt DESC, id DESC) cursors, not authorization tokens or
cross-page snapshots. The append/query interface is not database tamper protection.
Limits, P04's direct-input example, isolated verification and pending integration
live in docs/design/mvp-i02-audit-2026-10-14.md.

## Extension contributions

platform/extensions exports pure typed Entry/Source/Point contracts and an immutable
unique index. It never imports Nest. The separate discovery entry has two paths:
collectDeclarations reads only own class metadata on registered modules/providers
after Nest's module scan, without requiring instances; collect binds existing
provider/method targets after module initialization. Instance behavior requires
static singletons and rejects request/transient dependency trees. Both skip aliases
and cache candidates once; neither invokes contribution methods. Declaration
classes are deduplicated by constructor identity, including repeated dynamic-module
instances. Metadata validation and execution semantics belong to each host.

AuthorizationRegistry initializes itself in onApplicationBootstrap, after all
onModuleInit hooks and before listen/readiness. Bootstrap supplies required/explicit
definitions through PermissionConfigurationModule; only its configuration token is
global. Organization contributes explicit data; WorkspaceService carries
the workspace definitions as metadata. Definitions and sources are snapshotted and
published once; duplicate, invalid or missing required definitions abort startup.
PermissionKernel first requires a registered compatible scope, then loads live policies
for its isolated Casbin evaluator. Declaration alone grants no access. Application services
explicitly invoke transaction-mandatory permission writes; discovery never writes the DB.
PermissionModule retains ordinary imports and exports only Kernel to Nest consumers.

## Authorization foundation

System administrator access is the explicit account-level exception approved
after P09 access diagnosis. `User.isSuperAdmin` defaults to false and is managed
only through the operator CLI, not ordinary roles or request input. PermissionKernel
permits registered actions and enumerates active scopes for these accounts;
Organization/Workspace requireAccess resolves real targets without requiring
membership or manufacturing member IDs. requireMembership retains its original
facts-only meaning. Owner-gated governance and capability projections recognize
system administrators without changing the actual organization owner. Ordinary
users retain all existing membership and grant requirements. Authentication,
target/scope integrity, business invariants and transactional audit still apply.
See docs/design/system-super-admin.md for grant/revoke commands and boundaries.

core/authorization resolves trusted organization/workspace membership facts and coordinates
Permission checks through check/require/scope. Neither core reads request ALS. Scope results
are explicit none/organization IDs/workspace pairs, applied before pagination and counts.
WorkspaceContext no longer imports Permission; its requireMembership is facts-only.
Organization/Workspace callers use Authorization for reads and Permission's mandatory
write primitives for roles/bindings while preserving owner-only workspace creation,
explicit initial grants and transactional audit. Missing and inaccessible contexts keep
the same team 403 wire contract. Internal organizationIds/workspaceIds are removed.

The existing tables are the only durable policy source; no casbin_rule, cross-request
allow cache, owner bypass or hierarchy is introduced. Standalone policy reads use
RepeatableRead; ambient reads/writes join the existing DatabaseRuntime transaction.
Catalog synchronization is explicit. Replacement updates the parent Role before replacing
permissions so competing snapshots cannot silently merge grants. Details, internal API
changes and verification limits: docs/design/permission-authorization-2026-10-15.md.
The dated foundation record predates P06; P06 member/invitation/role management is
recorded separately above. Neither implementation includes node inheritance.

Permission context resolution belongs to Authorization (I04), not Resource (I05).
Business targets must resolve to their actual organization/workspace through
domain-owned fact providers before policy evaluation. ResolvedContext means facts
have been checked; AuthorizedContext additionally means the current action passed.
The resolver now accepts supplied organization/workspace scopes or UUID business targets,
checks expectedScope against domain facts, and produces resolved facts before policy evaluation.
Only successful checks add authorized: true. Target providers use the I03 immutable index;
static singleton discovery is enabled by default, with optional explicit configuration
and required-kind startup checks. Provider failures propagate outside the membership-denial
conversion. P07 now supplies the first real material provider and bounded
lifecycle/query acceptance. ResourceIdentity remains a cross-domain identity/reference,
not an authorization graph or mandatory route for every permission check. Current
design, transaction/query boundaries and the P07 handoff live in
docs/design/permission-authorization-2026-10-18.md. Implementation, contribution examples
and isolated verification limits live in docs/design/mvp-i04-2026-10-18.md.

ErrorResolver retains explicit assembly and error allowlists. Logger uses static
LoggerExtension declarations on owner modules (and the existing performance
interceptor), with the same pure index and duplicate checks. Projectors run on the
main thread; workers receive only serializable pretty-module references. Ordered
business mappers, request metadata and infra configuration are not migrated.
New business contribution files may use an optional contribution directory; existing
unimplemented extension skeletons are not bulk moved. Interfaces and isolated evidence
live in docs/design/mvp-i03-extension-2026-10-15.md and
docs/design/logger-contribution-2026-10-15.md.

## WebSocket foundation

platform/websocket now hosts Socket.IO on the API's Fastify HTTP server, path
/socket.io and namespace /app. Public protocol helpers, payload/ACK schemas and
derived frontend event maps live in contracts/protocol; future business events
belong in domain-owned *.ws.ts files. There are no business subscriptions yet.
Business gateways use ordinary Nest registration plus WsMessage/WsPayload/WsContext.
Session verification runs at handshake and for each request/delivery, with fresh
message ALS and OTel spans, bounded admission and cooperative cancellation.
Rooms do not authorize; push callers must authorize each recipient. HTTP-only
global guards/interceptors skip WS. Shutdown drains real WS work before shared
dependencies close. Realtime Core/Infra placeholders were removed; SSE remains
an independent TODO under platform/http/sse. No multi-instance adapter or frontend
connection UI is included. Details and limits: docs/design/websocket.md.

## Cookie binding

`platform/http/decorators/Cookie` selects one name, multiple names, or the complete
parsed Cookie map. `schema` controls optionality/defaults and async validation;
without it, selected names are required. `onFailure` defaults to throwing the
existing request validation error or may return whole-parameter undefined.
Programming/configuration errors and downstream pipes are never softened. Schema
parameters use output type aliases rather than DTO classes to avoid global-pipe
revalidation. Usage and verification limits live in docs/design/cookie-binding.md.

## Outbound HTTP

`infra/http` provides independent, factory-managed Axios clients, total deadlines,
cancellation, bounded admission/send queues, safe retries, opt-in request
singleflight and scoped credential-refresh gates. Provider adapters retain endpoint
contracts, credential protocols and domain error interpretation. Casdoor uses its
public Axios adapter hook; standard OIDC uses the ordinary client. Existing IAM
requests retain disabled retries/singleflight. Refresh callbacks must use a
separate ungated client, never the blocked client's admission queue. No outbound
Core Kernel, global Axios mutation or additional S3 retry layer is introduced.
Usage, limits and lifecycle semantics live in docs/design/outbound-http.md.

## Outbound mail

`infra/mail` requires explicit MailModule.forRootAsync configuration at composition
and exports only MailService as an application-wide Nest provider. It does not read
global ConfigService. AppModule registers the default instance once. Activation
snapshots and validates SMTP configuration; Nest initialization verifies
connection/TLS/auth without sending. Known MailError probe failures are logged at
error level without rejecting initialization; invalid configuration structure and
unknown programming errors still fail. Explicit verify/send calls keep rejecting
failures, and a failed startup probe does not permanently disable the transport.
Send returns SMTP accepted/partial recipient results, never an inbox-delivery promise.
The adapter owns Nodemailer SMTPConnection/MIME operations, bounded concurrency,
phase/whole-operation deadlines, cancellation and drain/forced socket teardown.
There is no automatic retry, pooled requeue, Outbox or business recovery flow.
Known failures use MailError with phase/outcome; unknown programming errors retain
identity. Safe English observations and diagnostics exclude recipients, content,
credentials and raw server replies. Usage, internal breaking changes and isolated
verification limits live in docs/design/mvp-i01-mail-2026-10-13.md.

The Web composition imports AuthRecoveryModule, which injects the shared MailService
for P02 password recovery without registering MailModule. The provisioning CLI
registers IAM but neither Mail nor Storage and never initializes SMTP. Mail itself
does not own recovery tokens or account rules; the business delivery policy lives
in Auth.

## Database runtime

`infra/database` owns the Prisma-backed DatabaseRuntime. Its native `client` is
an explicit context-bypassing escape hatch; ordinary callers use `queryClient`.
The query view is derived from the managed Prisma query extension and hides
transaction control. Model/raw queries normalize recognized Prisma/driver failures
automatically; there is no public execute wrapper. DatabaseClient owns a native
client and its managed extension rather than subclassing PrismaClient. Startup
performs SELECT 1 because PrismaPg pool initialization alone is not a connection
check. Driver-adapter-utils is an explicit SDK dependency of the normalizer.

`transaction.run` supports required (create or join), mandatory (join only), and
requiresNew (a separate native transaction and ALS scope). The database-owned
context is independent of request ALS. Physical scope IDs use one monotonic ULID
generator per manager. Joined failures and recognized managed-query execution
failures mark rollback-only, even when business code catches/maps them;
Prisma input validation and missing-record control flow do not by themselves do so.
closed/unbound contexts never fall back to the ordinary client. Joined options
must match declared outer options, and unspecified isolation remains the database
default rather than being silently assumed. Transactions are never retried
automatically. `current` returns a frozen diagnostic snapshot, not a raw scope.

`afterCommit` callbacks belong to the physical transaction that accepted them.
They execute sequentially without a database transaction context only after a
confirmed commit; failures are logged without changing the committed result.
They are best-effort hooks, not durable messages. No savepoint, workflow engine,
extra Core transaction Port or backward-compatibility facade is introduced.
The actual contract and runtime verification live in docs/design/database-runtime.md.

Identity retains domain-level dependency mappers, composed explicitly with
platform/error's composeErrorMappers. Its database mapper recognizes owned
constraints without an operation/conflict argument. Unknown errors retain identity;
composition neither recursively walks causes nor registers global rules. Existing
nested user/external-identity creation remains atomic. W07 replaces raw Prisma
creation inputs with owned account/profile/binding commands and explicit snapshot
selects; it does not add an encompassing registration/session transaction.

## IAM runtime

Casdoor remains required; application and explicit issuer retain their existing
optionality. Web and provisioning composition each register
IamModule.forRootAsync once.
IAM adapters do not read global configuration. The module exports only
CasdoorOidcClient, which returns whitelisted verified identity/profile fields rather
than supplier tokens, raw claims or SDK models. Options are snapshotted and the RSA
key is validated once during construction. Internal SDK helpers remain supplier-local
and unregistered until an approved use requires them; there is no raw SDK escape hatch.
HTTP resources retain HttpClientFactory ownership. Normal login preserves the existing
AT fallback and registration branches; W05 and public HTTP contracts are unchanged.
W07 interfaces, transaction participation and verification limits are recorded in
docs/design/iam-identity-access-2026-10-13.md.

## Shared Infra composition

StorageModule, IamModule and MailModule expose only forRootAsync and register their
declared public providers globally within one Nest application context. Configuration
mapping lives in bootstrap/composition/infra.composition.ts; business modules inject
the provider class token and never register another instance. AppModule activates all
three; AccountProvisionModule activates only IAM. SDK clients and options tokens stay
private. Singleton ownership comes from one registration per composition root, not
from the method name or a process-static cache. Details and the future Casdoor
authorization placement live in docs/design/infra-root-composition-2026-10-14.md.

## Dependency direction

    bootstrap / composition / app.module.ts
        |  explicit Nest composition
        +--> Platform (HTTP / WS / worker runtime)
        +--> Modules (business use cases and transport adapters)
        +--> Core (capability interfaces)
        `--> Infra (technology adapters)

    Platform / Modules / Infra  --->  Core
    Infra                         --->  Platform runtime helpers or other Infra
    Core                          --->  Core, Infra, or non-transport Platform runtime support

Direct imports are allowed when they express a real, explicit implementation
dependency. A Kernel may directly use an Infra adapter when that technology is
intrinsic to its current behavior: for example, PermissionKernel may use the
Casdoor IAM adapter. An Infra adapter may use a Platform runtime helper such
as ALS or logging, and an Infra module may compose another Infra module. None
of these relationships requires a top-level barrel or a new public interface.

Core must not depend on transport-specific entry details such as HTTP DTOs,
controllers, Fastify request/reply objects, or route decorators. Its public
interface must not expose raw technology-SDK types to business modules. A
Kernel or Port becomes a stable cross-module interface only when callers need
capability semantics rather than a particular implementation, or when a real
variation needs to be hidden. Nest module exports only control DI-provider
visibility; they are not an application-wide public surface.

## Boundary rules

- main.ts calls bootstrap(). bootstrap/bootstrap.ts creates the HTTP runtime,
  installs framework-level behavior, and owns process-startup side effects.
  bootstrap/lifecycle/shutdown.ts owns the single signal path and finite process
  deadline. It drains HTTP before invoking Nest close/hooks and flushes Pino last;
  do not also enable a competing Nest signal handler. KVS owns bounded connection/
  close teardown; Prisma disconnect runs in onApplicationShutdown after module
  destruction. Total budget exhaustion is an explicit failed shutdown, not a
  successful adapter cleanup.
  bootstrap/composition/app.module.ts is the Nest composition root for active
  global capabilities, including the explicitly configured default IAM/Mail/Storage
  providers. Other Infra dependencies retain their existing explicit imports.
- bootstrap/composition may know the full graph and bind Core ports to Infra
  adapters; it contains no business behavior. Do not use a root infra/index.ts
  barrel as an alternative composition mechanism.
- config owns typed runtime configuration. Code outside it should not read
  process.env directly. config/internal owns config.validation.ts and
  config-file.reader.ts as private support, not general utilities or public exports.
- Do not add a global constants layer. A DI token lives beside the Port or
  adapter it identifies; an HTTP header or decorator metadata key lives beside
  its owning Platform transport code. There is no current global constants
  directory to migrate.
- Do not build a common taxonomy for errors, results, assertions, and types.
  A pure helper begins beside its first owner and moves to common/utils only
  after genuine cross-domain reuse. common must never become a shared catch-all.
  Current runtime callers import the lightweight common/utils/crypto.ts
  directly. Legacy formatter, env/schema and operation utilities remain pending
  a separate review; their presence does not make them approved runtime entry
  points. There is no common/utils root barrel. HTTP credentials belong to
  platform/http/credential.ts; connection timeout support belongs to infra/kvs.
- platform may depend on NestJS and Fastify. It contains HTTP guards,
  decorators, filters, interceptors, WebSocket/SSE/worker transport adapters,
  ALS runtime context, extension discovery, and inbound telemetry.
  Adapter-local resource lifecycle remains in that adapter's Nest lifecycle
  hooks. platform/lifecycle exists only if a real bridge from Nest lifecycle to
  a Core runtime lifecycle is introduced.
- JSON controller interfaces declare request schemas and status-specific response
  schemas in ApiRoute. platform/http/route compiles the same envelope contracts
  for OpenAPI and runtime validation. Method/path and parameter binding remain
  Nest concerns; business authorization and error reframing remain owner-local.
  The first global guard captures route contracts before authentication/throttling.
  Streams and manually sent responses are not JSON ApiRoute interfaces.
- core consists of cross-domain application capabilities. Each Kernel is the
  stable public entry point of one capability; its directory may also contain
  contracts, policies, registries, ports, and direct implementation
  dependencies that are intrinsic to that capability. A direct dependency does
  not make a Kernel less valid; only its public interface must keep technical
  details local.
- infra implements external technology boundaries. It never decides a
  business use case. It may explicitly depend on Core contracts, Platform
  runtime helpers, or another Infra adapter when that relationship is real and
  acyclic. Current Casdoor SDK and OIDC adapters live in infra/iam; a future
  permission engine is not an already implemented infra/permission/casbin area.
  Modules must consume capability interfaces rather than expose SDK types.
- modules contains actual TalosArk business domains. Controllers remain here.
  Each module follows api, application, domain, extensions, cache,
  infrastructure, and public; only public is a stable cross-module API.
- system is for application-level health, version, and diagnostics, never a
  business domain.
- Owners use platform/error's defineErrorClass factory, not hand-written Error
  subclasses, to declare finite capability/technical reasons and private failure
  data. Infra normalizers alone know SDK errors; owner-local defineErrorMapper
  projections reframe only recognized dependency failures and retain cause.
  catchError consumes explicitly selected reasons; unknown errors rethrow.
- Contract public entries own code/message/details schemas. The separate
  @talos-ark/contracts/backend entry combines them with optional HTTP/WS policy
  and internal log levels. ErrorResolver looks up scope.reason in explicitly
  composed catalogs and validates public details; it neither traverses causes
  nor invokes business mappers. Missing protocol defaults safely in each adapter.
  No import-side-effect registry, global business taxonomy or public ALS metadata.
- nestjs-pino is the configured process logger; the legacy Logger wrapper has
  been removed. Log messages and pretty summaries use English unless the user
  explicitly requests Chinese. A transport boundary records the terminal failure once, using
  platform/error's library-neutral diagnostics and bounded cause serializer.
  The existing nestjs-pino integration remains replaceable without changing
  error factories, catalogs, resolver or business projections. Adapters that rethrow do not also
  log the same command failure. Current inbound performance instrumentation is
  platform/http/http.observation.ts, registered before Nest routes and guards. The composition root
  registers platform/observability/logger/logger.module.ts, which supplies one
  Pino root to nestjs-pino for both request and out-of-context logging. LOG_OUTPUT
  selects console/file/both in one asynchronous worker. Console format is pretty
  or JSON; files are JSON with optional time/size rotation and count retention.
  Unspecified settings preserve development pretty console and other environments'
  single JSON file. Sampling drops only trace/debug/info before serialization,
  once per record for both outputs; warn/error/fatal still obey level filters.
  Event-keyed, owner-local pure pretty adapters customize only
  the summary; existing structured fields remain visible. The worker owns the
  header and linear error stacks; branching errors and ordinary objects retain
  pino-pretty rendering. Owner module declarations supply diagnostic/pretty modules
  using native imports. The logger snapshots them after Nest scans the graph;
  every startup waits for all enabled destinations (including actual file opens)
  within the configurable 5-second default deadline. Pretty imports and duplicate-event
  checks run only when pretty is enabled. Failure aborts startup and closes the worker;
  the worker's asynchronous flush waits for parsing, rendering and all sink buffers
  inside the existing process log budget.
  File prefixes require one writer; containers can use JSON stdout for external collection.
  Flat JSON diagnostic fields are
  bounded and cannot override serializer/Pino structure. Workers never import Nest
  or SDK modules. Usage and extension
  rules live in docs/design/logger-pretty.md. Register forRoot() at composition
  time so every imported InjectPinoLogger context is available.

- platform/observability owns logging, metrics, tracing and their private SDK/exporter
  implementations; there is no separate infra/observability package. main/worker initialize
  typed, opt-in OTel before dynamically importing their application graph. Fastify owns
  request spans; its lifecycle observation records completion/abort once, including guard
  rejection and unmatched routes. Pino attaches active trace IDs before its output worker.
  Owner-local HTTP/Database telemetry records independent unsampled metrics; gateway
  attempts propagate W3C trace context, and Prisma supplies additional query spans.
  Span projection removes SQL, URLs, vendor exception events and status descriptions
  before batching. Existing business ALS and transaction semantics are unchanged.
  Shutdown drains resources, closes telemetry within its budget, then flushes logs.
  BackgroundJob persists optional W3C source context; acquired attempts create independent
  consumer traces linked to that source and record confirmed execution outcomes. Shared SQL
  backlog is sampled with a diagnostic Redis lease, strict query budgets and explicit caps,
  never queried during export. KVS observes node-redis diagnostics without patching its API;
  opt-in runtime metrics cover main-thread GC/event-loop windows. Mail/Storage/IAM own
  logical-operation observations; S3 attempts/presigning/stream consumption have separate
  meanings, and token rejection is observed without changing synchronous return contracts.
  Queue dispatch/connection events and HTTP credential/send-slot waits are observed separately.
  Core permission-engine, password, session verification, idempotency and audit entries expose
  bounded technical metrics without actor, payload or key labels; audit/idempotency return
  metrics do not claim a committed business transaction. Startup/shutdown spans do not become
  active parents of long-lived callbacks; readiness remains process-only. Collector deployments,
  host/container monitoring, dashboards and alerting remain later work. The coverage matrix and
  evidence limits live in docs/design/observability-infrastructure-coverage.md.
  Existing databases need the explicit background-job-telemetry upgrade before deployment;
  startup does not apply DDL. Contracts, configuration and verification limits live in
  docs/design/observability-application-loop.md.

## Layout

    packages/backend/
    +-- src/
    |   +-- main.ts                            # process entry
    |   +-- bootstrap/
    |   |   +-- bootstrap.ts                   # HTTP runtime creation
    |   |   +-- composition/                   # explicit runtime wiring
    |   |   |   +-- app.module.ts              # Nest composition root
    |   |   |   `-- error.provider.ts          # explicit error catalogs and adapters
    |   |   `-- lifecycle/                     # process-wide startup/shutdown only
    |   +-- config/                            # typed runtime configuration
    |   |   `-- internal/                      # private environment validation and file reading
    |   +-- common/utils/                      # lightweight crypto + retained legacy tools
    |   +-- platform/
    |   |   +-- error/                         # factory, reframe/catch helpers, resolver, diagnostics
    |   |   +-- request/                       # channel-neutral request rejection errors
    |   |   +-- http/                          # HTTP guards, filters, pipes, decorators
    |   |   +-- websocket/                     # authenticated Socket.IO boundary; SSE is under http/
    |   |   +-- context/                       # ALS runtime adapter
    |   |   +-- extensions/                    # pure typed contribution index; discovery/ Nest bridge
    |   |   +-- observability/                 # logger, OTel metrics/tracing and private exporters
    |   |   `-- lifecycle/                     # only a real Nest -> Core bridge
    |   +-- core/
    |   |   +-- context/ identity/ session/
    |   |   +-- organization-context/ workspace-context/
    |   |   +-- resource/ permission/ authorization/ cache/ lock/ idempotency/
    |   |   +-- event/ task/ file/ quota/ risk/ audit/ notification/
    |   |   +-- background/ clock/
    |   +-- infra/
    |   |   +-- database/                      # database runtime, query view and transaction context
    |   |   +-- http/                          # factory-managed outbound HTTP clients
    |   |   +-- kvs/                           # Redis/Valkey client, keys and Lua support
    |   |   +-- iam/                           # retained Casdoor and OIDC adapters
    |   |   +-- queue/bullmq/                  # TODO adapters, not a running queue
    |   |   +-- storage/                       # retained S3-compatible adapter
    |   |   +-- mail/                          # retained generic SMTP adapter
    |   |   `-- search/                        # TODO external adapters
    |   +-- modules/
    |   |   +-- auth/
    |   |   +-- organization/ workspace/ material/ inventory/
    |   |   +-- facility/ equipment/ approval/
    |   +-- system/                            # health, version, diagnostics
    +-- prisma/
    |   +-- schema.prisma                      # generator + datasource; no migrations or seed
    |   +-- model/*.prisma                     # MVP models split by domain
    |   `-- ddl/                              # controlled native SQL, not Prisma migration history
    |       +-- init/                         # database prerequisites before schema synchronization
    |       +-- schema/                       # native objects after schema synchronization
    |       `-- upgrade/                      # reserved for future reviewed upgrade policy
    +-- ops/
    |   +-- prisma/                            # Prisma CLI-only environment profiles
    |   +-- docker/                            # Dockerfile and dev/full Compose
    +-- secrets/                               # environment and key material
    +-- test/
        +-- unit/                              # retained technical-adapter tests only

## Error file naming

- Owner-local error definitions use `<owner>.error.ts`.
- Error support uses `<owner>.error.<role>.ts`: `normalize`, `mapper`, `policy`,
  `filter`, or `adapter`. For example, `database.error.normalize.ts` and
  `identity.error.mapper.ts`. A normalizer classifies SDK/framework failures;
  a mapper changes the meaning of a recognized dependency failure.
- Owner-neutral runtime support remains `platform/error/error.<role>.ts`.

The historical Platform/Common inventory is recorded in
docs/reviews/platform-common-review-2026-10-10.md. W01/W02 follow-up status and
the narrowed utility-retention scope are recorded in
docs/design/backend-work-plan-2026-10-11.md. Duplicate authentication/context/
telemetry skeletons and unused root entries have been removed; other approved
business skeletons remain unimplemented. HTTP middleware and interceptors now
have responsibility-specific files without changing their composition order.

W03 lifecycle and health contracts are recorded in
docs/design/backend-w03-2026-10-11.md. system/health now provides real public,
unthrottled live/ready routes with ApiRoute validation. Readiness is explicitly
process-scoped initialization/draining state, not ongoing external dependency
health. HealthState is marked ready only after successful listening and cannot
become ready again after stopping. Future provider health checks require their
own finite-budget design rather than extending this meaning silently.

## Session lifecycle

core/session validates TokenPair revocation and Session revocation/idle expiry
consistently during AT verification and RT rotation. Rotation additionally requires
an unexpired, unconsumed RT from the current Session generation. Its ReadCommitted
interactive transaction locks the public Session row, re-reads state and time,
conditionally consumes the RT, compares/increments version and creates the next
credential pair before commit. Session UPDATE revocation serializes with this lock;
future pair-revocation writers must follow the same Session-lock protocol.

RT reuse rejects only that request; it does not automatically revoke a Session.
Normal rotation does not invalidate older unexpired ATs: AT sv identifies its
TokenPair generation, not the Session's latest version. Actual PostgreSQL concurrency/rollback evidence,
schema assumptions and uncertain-commit limits live in
docs/design/backend-w05-2026-10-11.md. No generic lifecycle or retry layer was added.

The former core/access module, internal types and config namespace are now named session.
Access-token terminology, JWT_ACCESS_* inputs, HTTP contracts, the access.* public error
catalog and existing KVS key family identity/prefix remain unchanged. The Prisma model
file is session.prisma; model/table definitions are unchanged. Dated reviews/design
evidence retain historical names rather than being rewritten as new validation evidence.

P01 replaces browser HTTP delivery, not W05's token lifecycle. Refresh reads the
HttpOnly RT cookie, requires no AT, rejects body RTs, and returns public session/AT
data with no-store. Logout authenticates that cookie's session even without a
usable AT, revokes it, then clears the cookie and returns 204. Missing/inactive
cookies are idempotent logout. Both require an explicitly allowed Origin and
X-TalosArk-Client: browser; callers cannot supply sessionId. Login/OIDC success use
the same policy. The shared auth entry no longer publishes RT values. Historical
HTTP evidence in auth-session-http-2026-10-11.md does not describe this delivery;
current contracts/verification live in docs/design/mvp-p01-fix-2026-10-13.md.
Automatic frontend restoration and provider single logout remain pending.

HTTP CORS and Auth share http.browserOriginPolicy: deny, nonempty exact allowlist,
development-loopback, or development-any. The development modes require
NODE_ENV=development; production allowlists require HTTPS. CORS_ENABLED controls
only protocol delivery, not Auth Origin/client-header enforcement. Development
profiles allow canonical HTTP(S) loopback origins on any port; test/prod use explicit
allowlists. Redirect/activation URLs remain independently configured.

## First-party accounts

P01 provides controlled operator provisioning and activation reissue, not public
registration. Separate hashed UserActivationToken credentials activate accounts
once. Username matching is case-sensitive; email matching is case-insensitive,
backed by canonical email writes, Prisma's ordinary unique index and identity.sql's
native CHECK after synchronization. CHECK failures remain technical DatabaseError
failures, not account conflicts or user-facing input validation. Identity owns
bounded Argon2id/PHC and private credential persistence under identity/internal;
passwords are not trimmed/case-folded. The neutral contracts/auth/password subpath
shares input bounds without importing transport DTOs. Auth prepares an opaque
password reference before the transaction, then orchestrates Identity writes and
Session-owned revocation/creation in one transaction. Identity never writes
Session directly. User -> Session locking and mandatory ambient writes prevent
partial credential/session results. Recent login uses Session.createdAt, never
the refreshed AT issue time. auth.firstPasswordSessionMaxAgeSeconds only limits
the first-password request; expiry does not revoke the session. Legacy scrypt hashes
are deliberately unsupported; no password/data migration is performed by this fix.

UserModule exposes only the authenticated current account with an explicit wire
projection; no arbitrary user query, organization membership or admin
GUI is activated. The compiled provision-account CLI requires database confirmation
and explicit consent to controlled secret-link stdout. It is not a seed and does
not send mail. HTTP_BROWSER__, IDENTITY_PASSWORD_HASH_CONCURRENCY and AUTH__ defaults
are present in all runtime envs; production URL values
must match actual deployment. P03 now connects real Web password/OIDC login,
activation/first-password setup, current-account reads and Cookie restoration/logout.
The backend wire contracts were not changed by that frontend slice. Web evidence,
synthetic-provider limits and deferred Tauri verification live in
../frontend/docs/design/mvp-p03-2026-10-14.md.

P02 supplies public password-recovery request/confirm routes and real recovery
pages. Requests acknowledge before account lookup and use a bounded process-local
queue, not reliable jobs. Identity issues hashed reset credentials only for accounts
with a local password; OIDC-only cannot create one through recovery. Confirming uses
the same User lock, mandatory credential transaction and Session-owned revocation;
password update, consumption and old-session revocation roll back together.
Request defaults are 30-minute credentials, 60-second email cooldown, five email
requests and twenty IP requests per one-hour window, explicit in all six envs.
No automatic login, hidden retry, Schema change or real mail-provider verification
is claimed. Ownership, failure behavior and evidence live in
docs/design/mvp-p02-2026-10-13.md.

## Documentation delivery

Published documentation belongs to packages/docsite. The backend export script
reads /api-doc-json from an already running instance, validates OpenAPI 3 and
atomically writes packages/docsite/api-reference/openapi.json; export itself
does not decrypt runtime env. The docsite build publishes Scalar and this same
specification under /api-reference/. Internal backend designs and reviews are
not implicitly published.

CD uses the exact built image digest and disposable PostgreSQL/KVS/SMTP with synthetic
configuration to collect the document. No business schema synchronization or
real provider calls are required for export. Casdoor remains mandatory in current
startup validation; its commented optional branch is not activated by delivery
changes. P02 adds a pinned Mailpit receiver and an independent RSA provider key to
the export fixture; it never uses real SMTP or publishes receiver ports. Deployment and document verification are recorded in
docs/design/backend-w04-2026-10-11.md.

## Storage topology support (I06)

FacilityModule exports FacilityStorageTopologyReader/Writer as public DI ports;
useExisting binds their private persistence implementations without forwarding
services. Other business owners consume these ports, never Facility's SQL. Generic
task infrastructure must not import Facility; owner-provided handlers may consume
its public capability. Object storage remains infra/storage, not this physical tree.

Create/move require an active managed transaction through mandatory propagation;
validation is inside that boundary. Queries use queryClient and parameterized SQL,
retaining existing DDL topology locks/path constraints without native-client casts.
Reader supports scoped lookup, children, descendants and visible ancestors. Explicit
none/topology/subtree read ceilings intersect organization/topology and active-state
conditions before pagination; they are trusted caller input, not authorization proof
or node inheritance. P08 must still define facility-use and node-access policy.
Reads are single statements; callers needing consistent policy/data snapshots wrap
authorization and reads in one suitable managed transaction.

Children use (sortOrder,id) keysets; descendants use native (path,id), resolving the
cursor node's current path inside SQL. Cursors bind the query context, not authority,
and do not promise cross-page snapshots during structural changes. The child-page
index adds id; it has not been applied to an existing database. Inventory owns exact
Decimal(20,6) string parsing/formatting helpers, not stock/unit business decisions.
The original I06 verification limits live in docs/design/mvp-i06-2026-10-18.md.
P08/P09 now activate their own HTTP routes and resource providers; their delivery
records below supersede that earlier foundation-only status.

## Facilities and storage (P08)

P08 now provides Facility registration and whole-facility workspace access,
organization governance and explicit owner grant initialization, arbitrary-depth
container/position maintenance, bounded grid creation, authorized queries and
atomic empty-subtree transfers between facilities in the same organization.
FacilityOperations shares the organization-write protocol and transaction audit;
position availability observes lifecycle and occupancy without reserving a position.
P09 acquires the organization write lock before rechecking and placing stock.
Resource descriptions retain organization ownership and validate a separate
accessContext. Batch resource creation is homogeneous and transaction-mandatory.
P08 schema objects were applied to test.local. P09 subsequently integrated stocked
relocation there; frontend integration remains separate. P08 evidence and wire
handoff: docs/design/mvp-p08-2026-10-19.md.

## Idempotency foundation (I07)

`core/idempotency` provides a business-independent `IdempotencyKernel` and a typed
`IdempotencyRepository` Port. Callers prepare a normalized request, then call `run`
inside an existing managed transaction; the kernel uses mandatory propagation and
never creates an independent transaction. Claim, business work and completion remain
in one transaction, so caught failures mark the outer transaction rollback-only.

The repository owns the existing business uniqueness namespace and must implement
atomic claim/conditional completion with `DatabaseRuntime.queryClient`. Operation is
part of the fingerprint, not an implicit namespace. Results use bounded canonical JSON
snapshots and caller-owned typed codecs; replay still requires the caller's current
identity and authorization. The ULID lease is transaction-bound, not a timed
distributed lock. The core adds no global table, cache, retry or HTTP interceptor.
P09 now supplies the first business adapter through InventoryOperation and binds
its kernel locally in InventoryModule. Receipt replay, conflicts, competing writes,
late-failure rollback and unavailable results were verified on test.local. See
docs/design/mvp-i07-2026-10-18.md and docs/design/mvp-p09-2026-10-19.md.

## Physical inventory (P09)

InventoryModule now owns receipt, physical-instance fact correction, authorized
stock/journal reads and stocked-container relocation. It consumes only Material
and Facility public APIs, plus existing Core capabilities. Material still owns
batch metadata and revision/archive rules; Facility owns structural validation.
All mutations join OrganizationWriteKernel; resources, placement, journals,
audit and InventoryOperation completion commit or roll back together.

Material.quantityScale is 0..6 (default 6), frozen with unit and branch after any
instance exists. Exact decimal strings never pass through number. Zero receives
DEPLETED stock but retains occupancy. Calendar production/arrival/expiry dates,
UNKNOWN/NONE/DATED expiry and instance-confirmed dates replace live batch-expiry
inheritance. InventoryCalendar uses INVENTORY_BUSINESS_TIME_ZONE (Asia/Shanghai
default, validated typed config, defaults in every application env).

New workspace-manager defaults include inventory permissions and batch management;
existing organizations require explicit owner-driven inventory/initialize. No
startup or read repair occurs. Reads require inventory.read plus material.read;
unreadable facility locations are null with locationRestricted=true, not absent
inventory. Resource providers resolve actual stock/instance workspace ownership.

Stocked relocation requires source/target structure management, effective membership
and read/transfer/material permissions in every affected workspace, and destination
facility use relationships for all of them. Preview fingerprints are rechecked
inside the organization/topology locks. All placements, including depleted or
expired items, move together without changing stock ownership or node identity;
per-workspace journals preserve old/new human location snapshots. Ordinary P08
movement still rejects occupied subtrees. Synchronous limits are 10,000 nodes and
1,000 occupied items, not benchmark claims.

Only P09 schema differences and inventory.sql checks were applied to empty affected
test.local tables; parallel file schema changes were not synchronized. Twelve
focused real-PG/synthetic-HTTP groups passed and synthetic records were removed.
Frontend pages, JWT/Cookie Web acceptance and Tauri remain pending. No permanent
test files were added. Interfaces, configuration, schema and evidence:
docs/design/mvp-p09-2026-10-19.md. Later P09 Web/relocation acceptance is recorded in
../../docs/product/mvp-p09-relocation-acceptance-2026-10-20.md. P13 multi-receipt
behavior remains unimplemented.

## Inventory actions (P11)

InventoryActionService implements consume, transfer, adjust and dispose through
the existing organization-write and idempotency protocols. Stock CAS, Placement,
journal, audit and durable receipt commit together. The pure domain planner owns
quantity/state transitions; InventoryOperationService owns shared receipt codecs,
current authorization and location-safe receipt projection. No new lock or retry
framework is introduced. Consumption to zero retains Placement; explicit disposal
releases it and preserves identity/history. Adjustment sets actual nonnegative
quantity without rewriting the initial quantity; disposed stock cannot revive.

Actions require independent permissions. Adjustment does not require facility
read/use, but all four new writes check the effective source lifecycle through
Facility's trusted transaction-mandatory reader. Disabled sources also block new
P09 stocked relocation. Completed requests replay under current authorization
without reapplying version, stock state, emptiness or lifecycle preconditions.
Current and historical location projections use current facility read authority;
hidden receipt node IDs become null without changing the durable result.

Only two transaction enum values and the active-state quantity CHECK were applied
to talos-ark_backend_test. Focused real HTTP/PostgreSQL and Web acceptance passed;
Tauri, deployment and high-volume performance are unverified. No permanent test
scripts were added. See ../../docs/product/mvp-p11-acceptance-2026-10-20.md.

## MVP database vocabulary

- First-party MVP identity uses account/password login and email password reset,
  alongside existing OIDC. Phone authentication is deferred. PasswordResetToken
  stores only a hashed, expiring credential and its consumption/revocation state.
- Material is a definition owned exclusively by one workspace. MVP does not
  share materials across workspaces.
- MaterialBranch is the coarse business distinction between chemical materials,
  biological materials and general consumables. MVP uses shared material
  attributes plus a finite set of branch-wide attributes, without specialized
  subtypes such as culture medium or serum; later specialization remains possible.
- MaterialType is a flat classification owned by one workspace, not a category
  tree or a specialized professional subtype model.
- MaterialBatch is optional manufacturer/source lot metadata for one material;
  the same batch may be received more than once. MaterialInstance is one physical
  item that can be stored and moved independently, including a bottle, tube,
  bag or box; StockItem is its current remaining quantity and stock state.
- Initial inventory quantity is the actual amount remaining when an instance
  is first registered, including zero, not its original package amount or a
  reconstruction of consumption before registration.
- Material quantity precision is the maximum number of fractional digits for
  that material, from zero to six; zero means whole-number quantities only.
- An instance's production and expiry dates are confirmed on registration;
  batch dates supply defaults, not a live inheritance relationship. An expiry
  date remains valid through that calendar day in the business time zone.
  Unknown expiry and an explicitly indefinite shelf life are distinct facts.
- Actual arrival date is optional historical receipt information, not the time
  the system registered inventory or an instruction to replay past balances.
- Inventory receipt registers one physical item at an authorized empty position.
  Correcting descriptive facts is distinct from changing quantity or location;
  a receipt's initial quantity and committed journal are not rewritten by editing.
- Consumption records the amount actually used from an existing physical item.
  The MVP excludes whole-item borrowing; consumption itself does not transfer
  custody, move the item or rewrite its initial registered quantity.
- Facility is an organization-owned storage place, such as a room, storeroom
  or managed storage area, with a designated management workspace.
- StorageTopology is a facility's storage layout. StorageNode represents a
  container or a final storage position within that layout; a named logical
  partition can be a container without being a separately registered device.
- Placement is a current, exclusive occupancy of one physical POSITION node.
  InventoryTransactionLine preserves previous and resulting states/locations.
- Storage relocation moves a container subtree within one organization and may
  change the facility governing its structure. It does not transfer organization
  ownership or the workspace ownership of the material and stock it contains.
- ApprovalRequest groups one kind of proposed stock action for multiple physical
  items, its applicant and one selected qualified approver in the same workspace;
  the applicant cannot self-approve. All lines receive an approval or rejection
  decision together in one review. Submitted lines and the selected approver are
  immutable; the applicant may withdraw a pending request and submit a new one.
- ApprovalLine records the proposed action for one physical item and its decision.
  An approver may approve only some items in a request; approval does not reserve
  or change stock or grant general direct-action permission.
- Approved execution is performed by the applicant and applies the exact approved
  intent once per approved line to actual stock, recording an InventoryTransaction.
  Lines execute independently. Direct execution and approved execution have
  separately granted authority; approved execution still requires the applicant's
  current application eligibility, membership, resource and facility authority.
- Approval scope binding fixes the source POSITION and governing facility, plus
  the destination POSITION and governing facility for transfers. Execution checks
  their current identities against the request; quantity changes alone do not
  invalidate approval when the approved amount remains available.
- Approved line abandonment is the applicant's decision to give up an unexecuted
  approved line. Approval revocation ends an unexecuted approval through the still
  qualified designated approver or an independently authorized revoker. Neither
  action reverses executed inventory facts. Temporary inability to execute is
  distinct from either terminal decision.
- Approval eligibility has no automatic deadline in MVP. A previously lawful
  decision survives the approver's later loss of authority; stopping its unused
  eligibility requires explicit revocation. Approval queries create workbench
  pending items without duplicating ordinary tasks or implying notification delivery.
- P12 implements these rules through the public contracts/approval subpath.
  Approval owns lifecycle, scoped participation and current resource projection;
  InventoryActionReader exposes narrow facts and InventoryActionWriter owns the
  common mandatory-transaction stock change. Direct execution retains its own
  permissions; granted execution derives intent from the persisted approved line.
  Stock changes, the unique approvalLineId journal link, terminal line state,
  audit and idempotency completion commit in one physical transaction. Recovery
  of an already successful execution checks current read authority, not eligibility
  for another write. Native state checks live in prisma/ddl/schema/approval.sql.
  Permission codes include approval.read.all; existing organizations explicitly
  initialize default role grants rather than receiving silent startup privilege
  expansion. Local real HTTP/database/Web evidence and deployment limits are in
  ../../docs/product/mvp-p12-acceptance-2026-10-20.md.
- Task is ordinary work. Approval todos and overdue presentation states are
  derived queries, not a second writable workflow or stored OVERDUE status.
- ResourceIdentity bridges attachments, audit and other cross-cutting references.
  `core/resource` now provides mandatory-transaction identity creation, startup
  Provider discovery and authorization-aware descriptor reads. The material Provider
  reuses the material facts reader and AuthorizationKernel; missing or unauthorized
  descriptions return null without labels or links. Its concrete owner still decides
  workspace ownership and authorization. Facilities/storage nodes (P08), batches
  and stock/instances (P09) now have providers; tasks still await their business slice.
- A storage-node permission inheritance boundary is a node's explicit choice
  not to inherit parent-node grants. Missing local grants alone do not express
  this choice; opting out is not an explicit Deny rule.

Schema coverage and transaction-level invariants are documented in
docs/design/mvp-prisma-schema.md. Schema validation is not evidence that the
MVP business services or database synchronization have been implemented.
Native DDL ordering and existing-tree upgrade precautions live in prisma/ddl/README.md.

## File-system and authorization decisions

- Storage now exposes SDK-free object contracts through infra/storage. Callers use
  explicit bucket/raw-key locations, structured presigned requests and independent
  multipart operations. It does not decide CAS keys, promote staging objects or
  own File upload sessions. StorageModule requires explicit forRootAsync configuration
  once in Web composition, globally exports only StorageService and owns SDK-client
  destruction.
  Bucket deployment configuration is mapped explicitly into File configuration.
  W06 implementation, breaking internal interfaces and verification limits live in
  docs/design/storage-2026-10-12.md. Copy/delete/upload success alone is not evidence
  of an authorized, verified or committed file asset.
- I08-A implements core/file with durable single/multipart upload sessions, immutable
  private candidates, streaming byte-count/full-SHA-256 verification, unbound owner
  reads/downloads/removal and explicit bounded cleanup. FileKernel takes a trusted
  explicit organization/user actor, rechecks membership and rejects ambient database
  transactions. Storage I/O runs outside SQL transactions; short managed writes use
  leases and session locks to fence publication. FileObject -> FileAsset locking
  protects retirement against active assets/references; future binding writers must
  share that protocol. FileModule is ordinarily imported; only its configuration
  token is global. Bootstrap maps existing staging/private bucket config, without
  new env switches, HTTP routes or startup storage operations.
  I08-B now adds purpose contributions, resource binding and authorized bound downloads;
  P10 now adds material attachment contracts, HTTP upload/bind/list/download/unbind
  routes and the material-owned FileKernel adapter. Frontend integration and real object
  storage deployment acceptance remain pending. Actual MIME detection and virus scanning remain deferred beyond this
  first attachment slice. No scheduler is activated:
  cleanup must be invoked by trusted maintenance, and unknown multipart upload IDs
  require staging lifecycle rules. The approved test.local database is synchronized
  to the current Prisma schema; dev/prod and real deployment acceptance remain untouched.
- Storage operations are checked/provisioned explicitly with `storage:check` and
  `storage:init` (see ops/docker/README.md), never by application startup. Upload
  progress does not initialize multipart storage; signing initializes it on demand.
  File maps known storage availability/configuration failures into its own error,
  and Material exposes `MATERIAL_ATTACHMENT_STORAGE_UNAVAILABLE` (HTTP 503) without
  leaking bucket/endpoint details. Missing buckets retain a distinct internal
  reason. Saved sessions keep their original bucket; cancellation does not require
  storage access. Local real-storage and isolated checks are not full authenticated
  business acceptance.
  APIs, options, deployment prerequisites and isolated verification
  live in docs/design/mvp-i08a-2026-10-18.md.
- The file kernel has no IMAGE, DOCUMENT, or VIDEO upload-purpose enumeration.
  I08-B's FilePurposeExtension uses existing singleton Discovery to freeze owner-contributed
  definitions/providers at application bootstrap. Definitions own extension/MIME pairs and
  size limits; providers own current read/manage authorization, governance/lifecycle locks
  and same-transaction change audit. File Core does not read ALS or hardcode owner permissions.
  Invalid/duplicate/non-singleton contributions abort startup, without database writes.
  Upload sessions now persist nullable purpose/resource intent; replay cannot retarget it.
  Generic uploads remain available, but first binding rechecks purpose admission.
  Binding/unbinding require ReadCommitted, including an explicitly compatible ambient
  transaction, and share FileObject -> FileAsset locks with cleanup. A joined old snapshot
  is rejected rather than used to authorize writes after a governance change.
  Bound uploader reads are denied; completion replay rechecks reference authorization.
  Reference pages use scope-bound (sortOrder,id) cursors, and download signing runs outside
  SQL transactions with a second current-authorization/reference check before return.
  Signing also rechecks upload session state after signing. Details, additive schema and
  isolated verification limits live in docs/design/mvp-i08b-2026-10-18.md.
- D10 defines the first material attachment purpose as `material.attachment`:
  approved document/image/spreadsheet formats, at most 100 MiB, one material per
  asset, and no existing-attachment reuse. Reading/downloading follows current
  `material.read`; binding/unbinding follows current `material.update`. Archived
  materials retain read-only attachments. Unlinking retains reference history but
  retires the asset: it neither restores uploader access nor allows reference
  restoration. I08-B implements these rules through the material purpose Provider, and
  P10 exposes the public HTTP contracts and material service adapter. Frontend attachment
  UI and real object-storage acceptance remain pending.
  The approved format list, lifecycle and interface constraints live in
  docs/product/mvp-attachment-contract.md at the repository root.
- Platform-level Casdoor OIDC remains the current identity-provider model.
  TalosArk-owned identity and session behavior belongs to core/identity and
  core/session, not Casdoor SDK code.
- Casdoor administration and remote enforcement are Casdoor Infra concerns, distinct
  from Permission's local Casbin evaluator.
  A future Casdoor authorization client belongs beside the OIDC client in infra/iam,
  registered by the same IamModule; authorization business decisions enter through
  core/permission. No remote authorization client is activated by the local evaluator.

## Reliable background work (I09)

`core/task` owns BackgroundJob, mandatory-transaction submission, frozen versioned handler
contributions, execution budget and fenced outcomes. BackgroundJob doubles as its Outbox;
ordinary Task and event Outbox/Inbox placeholders are unchanged. `infra/queue/bullmq` owns
connections, bounded SKIP LOCKED dispatch/reconciliation and Worker execution. Redis carries
only ID/generation. TASK_ENABLED defaults false until schema synchronization; Web supports
inline workers and a separate src/worker.ts composition avoids HTTP/SMTP/IAM initialization.
Shutdown stops workers before dependent File/Storage providers. Interrupted non-repeatable
work requires review; explicit manual retry preserves total attempts. First handler is bounded
file cleanup; no scheduler or credential-bearing mail workflow is enabled. See
docs/design/mvp-i09-2026-10-21.md for configuration, CLI, invariants and verification limits.

## Verification expectation

For a structure-only change, verify the source tree, stale imports, formatting,
the backend build, and the retained technical-adapter tests. Do not run
pnpm db:push, create migrations, or reintroduce old business behavior merely
to obtain a running API.
