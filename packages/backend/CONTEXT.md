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
  Do not recreate historical migrations or a seed script during this phase.
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

The `pnpm prisma` wrapper uses Commander for wrapper arguments and Inquirer Select
for environment selection. Explicit `--env`/`--env-file` selectors remain valid;
without one, interactive terminals choose from Prisma-only files in ops/prisma/env.
CI/non-interactive calls must select explicitly; there is no implicit dev fallback.
`pnpm db:init` runs only prisma/ddl/init SQL against the selected primary database,
and db:prepare remains an alias. It never synchronizes business tables or applies
upgrade scripts. CLI usage and initialization limits live in ops/prisma/README.md.

## Current iteration policy

The backend is in a rapid-iteration phase. Do not add, backfill, or maintain
test scripts unless the user explicitly requests them.

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

`infra/mail` requires explicit MailModule.forRoot/forRootAsync configuration and
exports only MailService as a Nest provider. It does not read global ConfigService
or register in AppModule by default. Activation snapshots and validates SMTP
configuration; Nest initialization verifies connection/TLS/auth without sending.
Send returns SMTP accepted/partial recipient results, never an inbox-delivery promise.
The adapter owns Nodemailer SMTPConnection/MIME operations, bounded concurrency,
phase/whole-operation deadlines, cancellation and drain/forced socket teardown.
There is no automatic retry, pooled requeue, Outbox or business recovery flow.
Known failures use MailError with phase/outcome; unknown programming errors retain
identity. Safe English observations and diagnostics exclude recipients, content,
credentials and raw server replies. Usage, internal breaking changes and isolated
verification limits live in docs/design/mvp-i01-mail-2026-10-13.md.

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
optionality. IdentityModule explicitly supplies IamModule.forRootAsync configuration.
IAM adapters do not read global configuration. The module exports only
CasdoorOidcClient, which returns whitelisted verified identity/profile fields rather
than supplier tokens, raw claims or SDK models. Options are snapshotted and the RSA
key is validated once during construction. Internal SDK helpers remain supplier-local
and unregistered until an approved use requires them; there is no raw SDK escape hatch.
HTTP resources retain HttpClientFactory ownership. Normal login preserves the existing
AT fallback and registration branches; W05 and public HTTP contracts are unchanged.
W07 interfaces, transaction participation and verification limits are recorded in
docs/design/iam-identity-access-2026-10-13.md.

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
  global capabilities.
- bootstrap/composition may know the full graph and bind Core ports to Infra
  adapters; it contains no business behavior. Do not use a root infra/index.ts
  barrel as an alternative composition mechanism.
- config owns typed runtime configuration. Code outside it should not read
  process.env directly. config-file.reader.ts is configuration-local support,
  not a general utility.
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
  platform/http/interceptors/performance.interceptor.ts. The composition root
  registers platform/observability/logger/logger.module.ts, which supplies one
  Pino root to nestjs-pino for both request and out-of-context logging. Development
  uses its custom pretty worker transport; other environments retain asynchronous
  JSON file output. Event-keyed, owner-local pure pretty adapters customize only
  the summary; existing structured fields remain visible. The worker owns the
  header and linear error stacks; branching errors and ordinary objects retain
  pino-pretty rendering. Explicit composition supplies adapter URLs and approved
  error projections; workers never import Nest or SDK modules. Usage and extension
  rules live in docs/design/logger-pretty.md. Register forRoot() at composition
  time so every imported InjectPinoLogger context is available. infra/observability
  is reserved for a real external sink or exporter, not another logger wrapper.

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
    |   +-- common/utils/                      # lightweight crypto + retained legacy tools
    |   +-- platform/
    |   |   +-- error/                         # factory, reframe/catch helpers, resolver, diagnostics
    |   |   +-- request/                       # channel-neutral request rejection errors
    |   |   +-- http/                          # HTTP guards, filters, pipes, decorators
    |   |   +-- realtime/                      # websocket and SSE adapters
    |   |   +-- context/                       # ALS runtime adapter
    |   |   +-- extensions/                    # Nest Discovery bridge
    |   |   +-- observability/logger/          # Nest Pino wiring and pretty worker transport
    |   |   `-- lifecycle/                     # only a real Nest -> Core bridge
    |   +-- core/
    |   |   +-- context/ identity/ access/ tenant/ workspace/
    |   |   +-- resource/ permission/ cache/ lock/ idempotency/
    |   |   +-- event/ task/ file/ quota/ risk/ audit/ notification/
    |   |   +-- realtime/ background/ clock/
    |   +-- infra/
    |   |   +-- database/                      # database runtime, query view and transaction context
    |   |   +-- http/                          # factory-managed outbound HTTP clients
    |   |   +-- kvs/                           # Redis/Valkey client, keys and Lua support
    |   |   +-- iam/                           # retained Casdoor and OIDC adapters
    |   |   +-- queue/bullmq/                  # TODO adapters, not a running queue
    |   |   +-- storage/                       # retained S3-compatible adapter
    |   |   +-- mail/                          # retained generic SMTP adapter
    |   |   `-- search/ realtime/ observability/ # TODO adapters and external exporters
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
    |       `-- upgrade/                      # explicit upgrades for existing data only
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

## Access lifecycle

core/access now validates TokenPair revocation and Session revocation/idle expiry
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

Auth exposes POST /api/v1/auth/session/refresh with a strict JSON refreshToken body
and no AT requirement; a valid RT is still required. It returns the existing
SessionCredentials wire shape in a 200 envelope with Cache-Control: no-store.
POST /api/v1/auth/session/logout requires a verified Bearer AT, revokes only its
claim.sid Session and returns 204 without content. Neither route trusts a caller's
sessionId or session Cookie. The shared contract lives in auth/session.http.ts;
transport evidence and client/uncertain-commit limits are recorded in
docs/design/auth-session-http-2026-10-11.md. Frontend automatic refresh and provider
single logout are not implemented by these routes.

## Documentation delivery

Published documentation belongs to packages/docsite. The backend export script
reads /api-doc-json from an already running instance, validates OpenAPI 3 and
atomically writes packages/docsite/api-reference/openapi.json; export itself
does not decrypt runtime env. The docsite build publishes Scalar and this same
specification under /api-reference/. Internal backend designs and reviews are
not implicitly published.

CD uses the exact built image digest and disposable PostgreSQL/KVS with synthetic
configuration to collect the document. No business schema synchronization or
real provider calls are required for export. Casdoor remains mandatory in current
startup validation; its commented optional branch is not activated by delivery
changes. Deployment and document verification are recorded in
docs/design/backend-w04-2026-10-11.md.

## MVP database vocabulary

- First-party MVP identity uses account/password login and email password reset,
  alongside existing OIDC. Phone authentication is deferred. PasswordResetToken
  stores only a hashed, expiring credential and its consumption/revocation state.
- Material is a definition owned exclusively by one workspace. MVP does not
  share materials across workspaces.
- MaterialType is a flat classification owned by one workspace, not a category tree.
- MaterialBatch is optional lot metadata. MaterialInstance is one physical
  bottle or tube; StockItem is its current remaining quantity and stock state.
- Placement is a current, exclusive occupancy of one physical POSITION node.
  InventoryTransactionLine preserves previous and resulting states/locations.
- ApprovalRequest grants eligibility to execute. Approval does not reserve or
  change stock; execution confirms an InventoryTransaction.
- Task is ordinary work. Approval todos and overdue presentation states are
  derived queries, not a second writable workflow or stored OVERDUE status.
- ResourceIdentity bridges attachments, audit and other cross-cutting references.
  Its concrete owner decides workspace ownership and authorization.
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
  own File upload sessions. StorageModule requires explicit forRoot/forRootAsync
  configuration, exports only StorageService and owns SDK-client destruction.
  Bucket deployment configuration remains available to the future File capability.
  W06 implementation, breaking internal interfaces and verification limits live in
  docs/design/storage-2026-10-12.md. File remains unimplemented; copy/delete/upload
  success is not evidence of an authorized, verified or committed file asset.
- The file kernel has no IMAGE, DOCUMENT, or VIDEO upload-purpose enumeration.
  Future modules contribute concrete file-purpose definitions through the
  FileKernel extension boundary.
- Platform-level Casdoor OIDC remains the current identity-provider model.
  TalosArk-owned identity and session behavior belongs to core/identity and
  core/auth, not Casdoor SDK code.
- Casdoor/Casbin administration is an Infra control-plane concern. Runtime
  authorization will enter through core/permission.

## Verification expectation

For a structure-only change, verify the source tree, stale imports, formatting,
the backend build, and the retained technical-adapter tests. Do not run
pnpm db:push, create migrations, or reintroduce old business behavior merely
to obtain a running API.
