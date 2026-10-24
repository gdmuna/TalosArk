---
title: Loading and Activation
description: Backend env file selection, precedence, empty inputs, working directory, and restart behavior
outline: [2, 3]
---

# Loading and Activation

Backend runtime configuration lives in `packages/backend/secrets/env/`. Package scripts use dotenvx to inject configuration before starting the backend. A filename does not automatically select the runtime environment.

## Files and commands {#files-and-commands}

Run these commands from the repository root. File paths in the table are relative to `packages/backend/`.

| Command                                        | Explicitly loaded files, in order                         | Merges local |
| ---------------------------------------------- | --------------------------------------------------------- | ------------ |
| `pnpm --filter @talos-ark/backend start:local` | `secrets/env/.env.development.local` → `.env.development` | Yes          |
| `pnpm --filter @talos-ark/backend start:dev`   | `secrets/env/.env.development`                            | No           |
| `pnpm --filter @talos-ark/backend start:prod`  | `secrets/env/.env.production`                             | No           |
| `pnpm --filter @talos-ark/backend test`        | `secrets/env/.env.test`                                   | No           |
| `pnpm --filter @talos-ark/backend test:local`  | `secrets/env/.env.test.local` → `.env.test`               | Yes          |

`.env.example` lists variables and example values; startup scripts do not automatically load it. Base profiles supply environment-specific configuration. Local files are sparse overrides and need only contain values that differ.

Changing `NODE_ENV` does not make the selected script load a different file. It controls parsing and business security rules, such as development origin modes and production authentication requirements.

## Precedence {#precedence}

Current scripts do not enable dotenvx's override option for existing process variables. For matching keys, precedence is:

```text
Existing process environment
    ↓
First loaded file, for example .env.development.local
    ↓
Later file, for example .env.development
    ↓
Code default when undefined
```

For example, with `REQUEST_TIMEOUT_MS=30000` in the base file and `REQUEST_TIMEOUT_MS=45000` in local, `start:local` selects `45000`. If the process environment already contains `REQUEST_TIMEOUT_MS=60000`, it selects `60000`.

Nest Config also currently tries the default `.env` in the working directory to supplement undefined inputs. It does not automatically discover `secrets/env/.env.<environment>`. Standard scripts inject profiles first; explicit package script selection is the deployment reference.

## Undefined, empty, and whitespace {#empty-values}

::: warning Empty values still override
`KEY=` explicitly supplies an empty value and overrides valid values in later files. Remove the assignment from local when no override is needed.
:::

Omitting an input and leaving it empty have variable-specific meanings:

| Input                       | Example                                          | Current behavior                                                          |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Undefined variable          | Omit `REQUEST_TIMEOUT_MS` from all input sources | Uses code default `30000`                                                 |
| Empty numeric input         | `REQUEST_TIMEOUT_MS=`                            | Coerces to 0, below minimum 1000; parsing fails                           |
| An input allowing 0         | `CORS_PREFLIGHT_MAX_AGE_SECONDS=`                | Coerces to 0 and passes; does not use default `86400`                     |
| Empty boolean               | `CORS_ENABLED=`                                  | Neither `true` nor `false`; parsing fails                                 |
| Empty origin list           | `HTTP_BROWSER_ALLOWED_ORIGINS=`                  | Parses to an empty array; fails in allowlist mode                         |
| Empty method list           | `CORS_ALLOWED_METHODS=`                          | Currently falls back to the default method list                           |
| Whitespace-only method list | `CORS_ALLOWED_METHODS="   "`                     | The original string is nonempty; trimming entries produces an empty array |

Do not leave all optional inputs blank as a general rule. See the [HTTP reference](./http.md#variables) for defaults, units, and empty-input behavior.

## Working directory and secrets {#working-directory}

Package scripts run from `packages/backend/`. Relative paths read by the backend, such as `CASDOOR_CERTIFICATE_PATH`, resolve against this directory, not the directory containing the env file.

Encrypted dotenvx profiles require their decryption material. Preserve existing public-key metadata and inject the decryption private key through your deployment mechanism. Contents of `.env.keys` are not application settings and must not be copied into public documentation or logs.

Example accounts, domains, empty secrets, and key shapes in the template are not valid deployment credentials. Providing real values and passing format checks still does not prove connectivity.

## Activation phases {#activation}

| Phase                                  | What it confirms                                                | What it does not establish                          |
| -------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Configuration parsing                  | Types, enums, bounds, and cross-variable relationships          | Dependency connectivity or feature availability     |
| Module construction and initialization | Module-specific constraints and implemented initialization work | Successful verification of all business requests    |
| Request or business operation          | The result of this operation under current settings             | Coverage of every scenario or production deployment |

HTTP configuration is parsed at startup and supplied to consumers. Editing disk files does not update a running instance; restart the process. Existing browser preflight caches may also remain until expiry.

## Independent tool scopes {#tooling-boundary}

- Prisma CLI selects independent profiles in `ops/prisma/env/`; it does not automatically read runtime env. Here `.local` is a selectable profile name, not an automatically inherited override layer.
- Docker Compose env configures images, published ports, and dependencies. Matching names do not automatically inject values into the backend process.
- `BACKEND_URL` affects only the OpenAPI export script, which does not automatically load or decrypt runtime env.
- Docsite settings such as `VITE_API_DOCS_PORT` belong to documentation build/runtime, not backend configuration.

<details>
<summary>Implementation sources and review date</summary>

Reviewed on 2026-10-14 against the development working tree: startup/test scripts in `packages/backend/package.json`, `secrets/env/README.md`, ConfigModule registration in `src/bootstrap/composition/app.module.ts`, `src/config/http.config.ts`, and `src/config/config-file.reader.ts`.

The default `.env` supplement was also checked against the installed `@nestjs/config` implementation. Independent Prisma selection is documented in `packages/backend/ops/prisma/README.md`. This page did not run the backend or verify dependency connectivity.

</details>
