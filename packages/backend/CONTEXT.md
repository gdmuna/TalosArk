# Backend context

packages/backend is TalosArk's NestJS backend package. This document is the
local source of truth for its architectural boundaries and reset state;
repository-wide routing lives in the root CONTEXT-MAP.md.

## Current reset state

The package is intentionally in a structure-first phase:

- Deprecated business implementations, the former file system, their paired
  tests, historical Prisma migrations, and the seed script have been removed.
- prisma/schema.prisma remains the database definition. Development schema
  synchronization uses pnpm db:push; do not recreate migrations or a seed
  script during this phase.
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

## Current iteration policy

The backend is in a rapid-iteration phase. Do not add, backfill, or maintain
test scripts unless the user explicitly requests them.

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
- nestjs-pino is the configured process logger. The current
  platform/observability/Logger wrapper is legacy code that must be retired
  rather than evolved into a second logging pipeline. platform/observability
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
    |   +-- schema.prisma                      # retained; no migrations or seed
    +-- ops/
    |   +-- prisma/                            # Prisma CLI-only environment profiles
    |   +-- docker/                            # Dockerfile and dev/full Compose
    +-- secrets/                               # environment and key material
    +-- test/
        +-- unit/                              # retained technical-adapter tests only

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
