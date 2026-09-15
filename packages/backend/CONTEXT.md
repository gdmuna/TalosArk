# Backend context

`packages/backend` is TalosArk's NestJS API package. This document is the
local source of truth for its source layout; repository-wide routing lives in
the root `CONTEXT-MAP.md`.

## Boundary rules

- `bootstrap/` is the composition root. It assembles modules, global Nest
  infrastructure, and process startup; it contains no domain behaviour.
- `modules/` owns external adapters. HTTP controllers and HTTP DTOs live here.
  Ordinary business modules also own their use-case services and repositories
  under `internal/`.
- A module may consume another domain only through that domain's exported
  `*Kernel`; repositories are private implementation details. For example,
  Node and Share use `OrgKernel`, never `OrgRepository`.
- `core/` contains reusable platform/domain kernels with a deliberately small
  public interface. Its `internal/` directory is not an application-wide API.
- `platform/` adapts transport concerns such as HTTP guards, request context,
  exception mapping, and observability. Shared security/authorization logic
  belongs in a kernel; an HTTP guard is only its HTTP wrapper.
- `infra/` implements concrete technical integrations. Do not introduce a
  port/adapter seam until there is a real second implementation to support.
- `shared/` is for framework-independent utilities only. It must not import
  Nest modules, HTTP objects, or domain modules.

## Layout

```text
packages/backend/
|-- src/
|   |-- bootstrap/                         # Nest composition root and process entry
|   |   |-- app.module.ts
|   |   `-- main.ts
|   |-- config/                            # Typed environment/config definitions
|   |-- core/
|   |   |-- context/                       # RequestContext service/module
|   |   |-- identity/                      # Password/OIDC/session kernel; only IdentityKernel is public
|   |   |   |-- identity.module.ts
|   |   |   |-- identity.kernel.ts
|   |   |   |-- identity.types.ts
|   |   |   `-- internal/                  # local account, OIDC transaction, session and token persistence
|   |   |-- file/                          # Object-storage kernel; only FileKernel is public
|   |   |   |-- file.module.ts
|   |   |   |-- file.kernel.ts
|   |   |   |-- file.types.ts
|   |   |   `-- internal/                  # repo, upload strategies, relation-registry TODO
|   |   |-- access/                        # TODO: future policy-evaluation kernel
|   |   `-- resource/                      # TODO: future shared resource-identity kernel
|   |-- modules/
|   |   |-- auth/                          # HTTP /auth controller and DTOs -> IdentityKernel
|   |   |-- file/                          # HTTP /files controller and DTOs -> FileKernel
|   |   |-- operations/                    # health and diagnostics HTTP endpoints
|   |   |-- org/                           # OrgKernel + controllers/DTOs + internal use cases/repos
|   |   |-- node/                          # controllers/DTOs + internal use cases/repos
|   |   |-- reagent/
|   |   |-- reagent-type/
|   |   |-- share/
|   |   |-- user/
|   |   |-- feedback/
|   |   `-- exception-catalog/
|   |-- platform/
|   |   |-- errors/                        # error taxonomy and registration
|   |   |-- http/                          # decorators, guards, filters, middleware, OpenAPI
|   |   `-- observability/                 # application logger integration
|   |-- infra/
|   |   |-- database/                      # Prisma implementation
|   |   |-- kvs/                           # cache implementation
|   |   |-- mail/                          # mail implementation
|   |   |-- storage/                       # S3-compatible object storage implementation
|   |   `-- iam/casdoor/                   # platform-level Casdoor OIDC adapter; policy admin stays private
|   `-- shared/utils/                      # framework-independent helpers
|-- prisma/                                # schema, migrations, seed
|-- ops/
|   |-- prisma/                            # Prisma CLI-only DATABASE_URL profiles
|   `-- docker/
|       |-- Dockerfile                     # shared backend image build
|       |-- apt/                           # Debian source definitions for the image build
|       `-- compose/
|           |-- full/                      # self-contained Compose: .env, Casdoor, PostgreSQL init, entrypoint
|           `-- dev/                       # local dependency Compose: .env and Casdoor
|-- secrets/                               # encrypted/non-committed runtime configuration
|-- test/
|   |-- unit/                              # isolated tests with mocked collaborators
|   |-- integration/                       # database-backed integration tests
|   `-- e2e/                               # HTTP-level tests against a running Nest app
`-- docs/adr/                              # backend-local architecture decisions
```

## Current implementation notes

- Identity owns local password credentials, external OIDC identity bindings and
  TalosArk-owned rotating refresh sessions. Access tokens remain short-lived
  JWTs. Auth controllers only call `IdentityKernel`; Casdoor SDK types remain
  inside the Casdoor Infra adapter. The current IdP model is platform-level,
  not organization-specific.
- `CasdoorAuthorizationClient` is a private Infra control-plane adapter. It is
  intentionally not exported through `CasdoorModule` or the Infra barrel;
  future policy management belongs to a platform-management use case, while
  runtime business authorization will go through `AccessKernel`.
- File relation definitions remain code-owned domain rules. The registry is a
  TODO placeholder rather than a database configuration table.
- Controllers remain concentrated in `modules/`, including wrappers for core
  capabilities (`auth`, `file`). Future WebSocket/SSE handlers belong
  in their owning module as transport adapters, while shared behavior stays in
  the corresponding kernel.
