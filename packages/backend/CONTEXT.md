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
  behavior exists. main.ts, app.module.ts, and bootstrap/bootstrap.ts are the
  real process and Nest runtime baseline; they do not imply that a business
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

## Dependency direction

    bootstrap / app.module.ts
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
  app.module.ts is the Nest composition root for active global capabilities.
- bootstrap/composition may know the full graph and bind Core ports to Infra
  adapters; it contains no business behavior. Do not use a root infra/index.ts
  barrel as an alternative composition mechanism.
- config owns typed runtime configuration. Code outside it should not read
  process.env directly. config-file.reader.ts is configuration-local support,
  not a general utility.
- Do not add a global constants layer. A DI token lives beside the Port or
  adapter it identifies; an HTTP header or decorator metadata key lives beside
  its owning Platform transport code. The current constants directory is
  transitional and should disappear as those owners are implemented.
- Do not build a common taxonomy for errors, results, assertions, and types.
  A pure helper begins beside its first owner and moves to common/utils only
  after genuine cross-domain reuse. common must never become a shared catch-all.
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
  acyclic. In particular, infra/permission/casbin is a technical
  Casbin/Casdoor adapter area; modules must depend on PermissionKernel, not
  Casdoor SDK types.
- modules contains actual TalosArk business domains. Controllers remain here.
  Each module follows api, application, domain, extensions, cache,
  infrastructure, and public; only public is a stable cross-module API.
- system is for application-level health, version, and diagnostics, never a
  business domain.
- Owner-local native Error classes describe capability/technical failures and
  keep their original cause. Infra normalizes recognized SDK failures; Core and
  Modules reframe them only when the operation changes their meaning. Unknown
  defects must not become availability, invalid-token, or retryable outcomes.
- platform/error resolves channel-neutral public codes and validated details
  through explicitly composed mappers. HTTP owns statuses, headers and envelope
  I/O; WebSocket owns message construction and correlation. No import-side-effect
  error registry, universal business-error hierarchy or public ALS metadata.
- nestjs-pino is the configured process logger; the legacy Logger wrapper has
  been removed. A transport boundary records the terminal failure once, using
  the allowlisted, bounded cause serializer. Adapters that rethrow do not also
  log the same command failure. platform/observability
  owns inbound request instrumentation; infra/observability is reserved for a
  real external sink or exporter, not another logger wrapper.

## Layout

    packages/backend/
    +-- src/
    |   +-- main.ts                            # process entry
    |   +-- app.module.ts                      # Nest composition root
    |   +-- bootstrap/
    |   |   +-- bootstrap.ts                   # HTTP runtime creation
    |   |   +-- composition/                   # explicit Port -> Adapter wiring
    |   |   `-- lifecycle/                     # process-wide startup/shutdown only
    |   +-- config/                            # typed runtime configuration
    |   +-- common/utils/                      # only proven pure cross-domain helpers
    |   +-- platform/
    |   |   +-- error/                         # neutral public error resolution
    |   |   +-- http/                          # HTTP guards, filters, pipes, decorators
    |   |   +-- realtime/                      # websocket and SSE adapters
    |   |   +-- worker/
    |   |   +-- context/                       # ALS runtime adapter
    |   |   +-- extensions/                    # Nest Discovery bridge
    |   |   +-- lifecycle/                     # only a real Nest -> Core bridge
    |   |   `-- observability/                 # Pino integration and inbound telemetry
    |   +-- core/
    |   |   +-- context/ identity/ auth/ tenant/ workspace/
    |   |   +-- resource/ permission/ transaction/ cache/ lock/ idempotency/
    |   |   +-- event/ task/ file/ quota/ risk/ audit/ notification/
    |   |   +-- realtime/ background/ clock/
    |   +-- infra/
    |   |   +-- database/prisma/               # retained Prisma adapter + future ports
    |   |   +-- valkey/                        # TODO cache/lock/pubsub/idempotency adapters
    |   |   +-- iam/casdoor/                   # retained platform-level OIDC adapter
    |   |   +-- permission/casbin/             # retained control-plane client + TODO engine
    |   |   +-- queue/bullmq/
    |   |   +-- storage/s3 and storage/rustfs/
    |   |   +-- mail/                          # retained generic SMTP adapter
    |   |   `-- search/ realtime/ external/
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
