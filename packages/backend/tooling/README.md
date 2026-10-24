# Backend Tooling

`tooling/` owns executable development and maintenance code. `ops/` keeps Docker,
deployment resources and database environment files. Application code in `src/`
does not import tooling; tools call application capabilities through their own
composition roots.

## Entrypoints

Run these commands from `packages/backend`. The repository root also forwards
`dev`, `tool`, `prisma`, `db`, `seed`, `db:seed`, `storage`, `account` and `task`.

| Direct entry | Shared route | Example |
| --- | --- | --- |
| `pnpm dev` | `tool app dev` | `pnpm dev --env dev.local` |
| `pnpm prisma` | `tool db prisma` or `tool prisma` | `pnpm prisma generate --env dev.local` |
| `pnpm db` | `tool db` | `pnpm db init --env dev.local` |
| `pnpm seed` | `tool seed` or `tool db seed` | `pnpm seed plan --group minimal --namespace demo-v1` |
| `pnpm storage` | `tool storage` | `pnpm storage check --env dev.local --origin http://localhost:4444` |
| `pnpm account` | `tool account` | `pnpm account super-admin grant --env dev.local --user-id <uuid> --username <name>` |
| `pnpm task` | `tool task` | `pnpm task failures --env dev.local` |
| `pnpm build` | `tool build` | `pnpm build --target seed` |
| `pnpm typecheck` | `tool check` | `pnpm typecheck --scope tooling` |
| `pnpm test` | `tool test` | `pnpm test --env test.local --coverage` |

`pnpm tool` displays a menu in an interactive terminal and help otherwise.
`--help` on a command never starts an application, compiles its runtime or loads
credentials. Package aliases prepend a route to the same CLI entry; they do not
start another package-manager process to dispatch an action.

`pnpm start` and `pnpm worker` directly run built application/Worker entrypoints,
using configuration injected by deployment. They do not compile or select files.
For local file selection use `pnpm tool app run --env dev.local` or
`pnpm tool app worker --env dev.local`. Build first. `start:prod` remains a
file-loading compatibility alias, but no longer builds before starting.

## Input And Configuration

`cli/input.ts` owns missing-input handling. Command modules declare the flag,
parser, prompt and example. An explicit value is parsed once and fails if invalid.
Missing values prompt in a TTY: choices for enumerable inputs, text for usernames,
namespaces, paths and other open-ended values. Interactive invalid input can be
corrected; Ctrl+C exits with status 130. CI, pipes and `--no-interactive` reject
missing required inputs with a named argument and example. Optional values keep
their documented defaults. CLI prompts never enter the Seed SDK.

Runtime commands select `secrets/env/` profiles. `dev.local`, `test.local` and
`prod.local` load their local file before the matching base file. Existing process
values win, followed by the first file, later files and code defaults. Multiple
explicit files use `--env-file <first> <second>`. `--env-process` explicitly uses
only inherited environment values.

Prisma and Seed database commands select independent `ops/prisma/env/` files;
database `.local` profiles do not inherit base files. They consume only
`DATABASE_URL` and `SHADOW_DATABASE_URL`. Configuration is loaded into an isolated
object and forwarded to the child that needs it, without globally rewriting the
CLI environment. Account provision uses runtime files; super-admin maintenance
uses database files.

```sh
pnpm tool env encrypt --scope runtime --env dev
pnpm tool env decrypt --scope database --env-file ops/prisma/env/.env.development.local
pnpm tool openapi export --url http://localhost:3000 --output ../docsite/api-reference/openapi.json
pnpm db ddl apply --only identity,storage-node,inventory,approval --env dev.local
```

Encryption/decryption locates one selected file and invokes dotenvx. A local
profile processes only its own file, without modifying its base or first reading
decrypted values. Native `pnpm exec dotenvx` remains available. DDL applies only
registered names in the order shown above and stops on failure. `db init` installs
only database prerequisites. Neither command runs upgrades, schema synchronization
or Seed automatically. There is no new production migration workflow here.

## Runtime And Builds

| Action | Execution |
| --- | --- |
| Help; Seed `list`/`plan` | Source via tsx; no Nest compilation or remote access |
| Seed `init`/`status`/`report` | Source via tsx; explicit database access, no Nest application |
| Seed `apply`/`verify`/`resume` | Resolve inputs, prepare `.cache/seed`, run Node with Nest constructor metadata |
| Storage, super-admin, OpenAPI | Source in development; compiled operational CLI when deployed |
| Account provision, task maintenance | Prepare `.cache/ops` in source checkout; use existing compiled runtime when deployed |
| `build` | Contracts, application and operational tools; `--target app`, `ops`, `seed` select one target |

Build preparation runs TypeScript's incremental compiler and alias resolver, so
source/configuration changes are reconsidered rather than trusting an existing
directory. Seed also refreshes SQL and fixture resources. `.cache/` is disposable
local build output; execution receipts live in PostgreSQL, and private credential
reports live at their explicitly requested paths. Generated Prisma types must
already exist. No build connects to a database or synchronizes schemas.

The Nest development watcher cleans `dist` when rebuilding. Use source maintenance
commands during development; create a complete `pnpm build` artifact for deployment.
Do not use a live watcher's output directory as a stable operational release.

Compiled maintenance entry:

```sh
node dist/tooling/cli/entry.js --help
node dist/tooling/cli/entry.js task failures --env-process
node dist/tooling/cli/entry.js storage check --env-process --origin https://app.example.test
```

The compiled CLI exposes account, task, storage and OpenAPI maintenance. It does
not expose development, Seed, Prisma, compilation or test commands. It runs with
Node and production dependencies; no tsx or TypeScript installation is needed.
Task `failures`, `inspect` and `prune` compose database/task/logging providers.
Retry and file-cleanup submission also load the registered file handler's
dependencies. Only explicit `recover` composes and starts the queue adapter, with
consumption disabled and shutdown in `finally`; maintenance never starts a Worker.

## Extending Commands

Register a lazy `ToolCommand` in `cli/registry.ts`. A command implements
`run(argv, context): Promise<void>` and owns its parsing, validation and behavior.
Use `context.input` for input completion, environment catalogs for selection, and
`cli/process.ts` for child processes and exit propagation. `sourceOnly` commands
are unavailable in the compiled operational CLI. New direct package aliases point
to `tsx tooling/cli/entry.ts <route>`, without another implementation or launcher.

Existing `db:*`, `auth:*`, `storage:*`, profile and test-mode aliases remain as
transition shims for callers and historical documentation. Add new actions to
their command module rather than adding more profile/action package scripts.
Docsite lifecycle commands belong to the Docsite package. Release helpers retain
their GitHub Actions behavior under `tooling/release/`.

## Verification Boundary

This refactor was checked with application/tooling/Seed type checks, application
and operational builds, lint, CLI help/input probes, interactive selection/text
entry and isolated compiled-runtime dispatch. Runtime probes replaced Nest
application contexts and Seed database targets; OpenAPI used a local fixture
server. They do not establish real database, SMTP, queue, storage or container
deployment acceptance. No real environment credentials were changed.

The existing Prisma environment unit file has a pre-existing expectation mismatch:
the URL redactor omits query parameters, while one assertion expects
`?schema=public`. The migration changes its import path and preserves the existing
redaction behavior; a full test-suite pass is not claimed.
