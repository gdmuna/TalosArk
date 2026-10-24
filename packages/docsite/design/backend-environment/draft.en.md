---
title: Backend Configuration Reference — Representative Draft
description: English examples of variable documentation, business properties, and cross-variable relationships
outline: [2, 3]
---

# Backend Configuration Reference — Representative Draft

> Review draft: these representative entries belong to several future reference pages and are collected here to demonstrate the writing format. This is neither the complete variable list nor a complete startup configuration. It has not been added to site navigation.

Reviewed on: 2026-10-13 (Asia/Taipei), using the uncommitted working tree. See the [source audit](./audit-2026-10-13.md) for the snapshot. Example domains and values illustrate the configuration format.

## Configuration loading {#loading}

`start:local` loads `.env.development.local` before `.env.development`; `test:local` behaves similarly. Existing process environment variables take precedence over these files, and the first file takes precedence over later files. Ordinary dev/test/prod scripts load only their respective base files.

Nest Config currently does not set `ignoreEnvFile`, so it also tries the default `.env` in the working directory to supplement undefined inputs. This does not automatically select `secrets/env/.env.<environment>`; explicit profile selection comes from the package scripts.

`KEY=` explicitly sets an empty value and overrides later files. Zod defaults generally apply only to undefined inputs; explain empty inputs using each variable's implementation. `.env.example` contains empty secret placeholders and still requires valid credentials and dependencies after copying.

Sources: [backend scripts](../../../backend/package.json), [env loading notes](../../../backend/secrets/env/README.md). Configuration is normally read during process startup or module construction; restart the process after changing the files.

## HTTP and browser origins {#http}

### HTTP_BROWSER_ORIGIN_MODE {#http-browser-origin-mode}

Select which browser origins the backend trusts. The CORS middleware and authentication interfaces using `AuthHttpSession.assertClient` share this policy.

| Property                    | Details                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Requirement/type            | Optional; enum string → origin policy object                                                                         |
| Accepted values             | `deny`, `allowlist`, `development-loopback`, `development-any`                                                       |
| Default/example/empty input | Code default: `deny`; development example: `development-loopback`; empty input fails enum validation                 |
| Status/timing               | Wired into CORS and authentication request checks; parsed at startup; restart after changes                          |
| Sensitivity/relationships   | Nonsecret; related to `NODE_ENV`, the [origin list](#http-browser-allowed-origins), and [CORS switch](#cors-enabled) |

`deny` rejects browser requests with an origin. General requests without Origin can proceed through CORS, but authentication interfaces using `assertClient` still require a valid Origin and `X-TalosArk-Client: browser`.

`allowlist` accepts only exact listed origins. `development-loopback` accepts `localhost`, `127.0.0.1`, and `[::1]`, including different ports; `development-any` trusts any valid HTTP(S) origin. Both development modes require `NODE_ENV=development` and are invalid in test/production.

Failure phase: an invalid enum or a development mode outside development fails configuration parsing; requests outside the policy are rejected. HTTPS for production allowlists is enforced validation.

Sources: [HTTP validation](../../../backend/src/config/http.config.ts), [origin matching](../../../backend/src/platform/http/browser-origin.policy.ts), [authentication checks](../../../backend/src/modules/auth/api/auth-http-session.ts).

### HTTP_BROWSER_ALLOWED_ORIGINS {#http-browser-allowed-origins}

Declare the browser site addresses trusted by allowlist mode.

| Property                  | Details                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Requirement/type          | Required in allowlist mode; comma-separated string → origin array                                                        |
| Format                    | Canonical HTTP(S) origin with exact scheme/host/port; no path, query, or trailing `/`                                    |
| Default/empty input       | Defaults to `''`, parsed as `[]`; empty input also produces an empty array; allowlist mode requires a nonempty array     |
| Status/timing             | Wired into runtime; every supplied entry is validated even in other modes; parsed at startup and changed through restart |
| Sensitivity/relationships | Nonsecret; every production entry must use HTTPS; only allowlist mode uses this list to decide trust                     |

Parsing trims each entry and removes empty entries. Wildcards are unsupported. `https://app.example.com` is valid; `https://app.example.com/activate` and `https://app.example.com/` are invalid. Changing only the list does not select allowlist mode.

```dotenv
# Partial production browser-origin configuration; other required startup settings still apply.
NODE_ENV=production
HTTP_BROWSER_ORIGIN_MODE=allowlist
HTTP_BROWSER_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

Failure phase: invalid origins, an empty allowlist, and HTTP origins in production fail startup parsing. Source: [HTTP validation](../../../backend/src/config/http.config.ts).

### CORS_ENABLED {#cors-enabled}

Control whether the CORS middleware handles protocol responses and origin filtering.

| Property            | Details                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Requirement/input   | Optional; accepts only strings `true` / `false`, parsed as boolean                                                                 |
| Default/empty input | Defaults to `true`; `KEY=`, `1`, and `TRUE` fail enum validation                                                                   |
| Status/timing       | Wired into the CORS middleware; restart to apply; nonsecret                                                                        |
| Relationships       | [Origin policy](#http-browser-origin-mode), allowed headers/methods, and preflight cache; authentication checks remain independent |

When set to `false`, the middleware proceeds directly without CORS response headers or its own origin filtering. Authentication interfaces still enforce origin policy and the client header; this does not provide an authentication bypass. Invalid input fails configuration parsing.

Sources: [HTTP validation](../../../backend/src/config/http.config.ts), [CORS consumer](../../../backend/src/platform/http/middleware/cors.middleware.ts), [authentication checks](../../../backend/src/modules/auth/api/auth-http-session.ts).

## Identity and authentication {#identity-auth}

### JWT_ACCESS_EXPIRES_IN {#jwt-access-expires-in}

Control the maximum lifetime of access tokens issued by this backend; issuance also caps it at the remaining session idle lifetime and refresh-token lifetime.

| Property                   | Details                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Requirement/input → output | Optional; positive integer followed by `s`/`m`/`h`/`d` → seconds                                                |
| Default/empty input        | Defaults to `15m`, or `900` seconds; empty input is invalid                                                     |
| Accepted values            | No zero, negative, decimal, missing unit, leading zero, or whitespace; converted seconds must be a safe integer |
| Status/timing              | Wired into AccessKernel token issuance; restart affects newly issued tokens; nonsecret                          |
| Relationships              | `JWT_ACCESS_PRIVATE_KEY` and `JWT_ACCESS_PUBLIC_KEY`; distinct from refresh-token and session lifetimes         |

A shorter lifetime reduces the access-token window and increases refresh frequency. Changing configuration does not rewrite expiration claims in existing JWTs. The algorithm is fixed to ES256; provide valid private/public keys suitable for P-256. Optional key inputs in the Schema do not make them optional at startup: AccessKernel requires both during construction. That constructor does not explicitly check key-pair matching or the curve.

```dotenv
JWT_ACCESS_EXPIRES_IN=15m
```

Invalid duration fails parsing or conversion. Missing keys or unparseable PEM fail AccessKernel construction. Algorithm suitability and key matching also require issuance/verification checks. Sources: [Access configuration](../../../backend/src/config/access.config.ts), [AccessKernel](../../../backend/src/core/access/access.kernel.ts).

### AUTH_RECOVERY_URL {#auth-recovery-url}

Configure the frontend password-reset page opened from a recovery email. The mail use case adds a recovery secret parameter to this base URL; the variable itself must not contain a token.

| Property                  | Details                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Requirement/input         | Optional URL string; production requires an explicit actual HTTPS page to replace the HTTP default                 |
| Default/empty input       | Defaults to `http://localhost:4444/auth/reset-password`; empty input is invalid                                    |
| Constraints               | HTTP(S) only; no username/password, query, or fragment; HTTPS is mandatory in production                           |
| Status/timing             | Read by password recovery, with mail wired into runtime; startup validation; restart affects newly generated links |
| Sensitivity/relationships | The base URL is nonsecret; related to the frontend route, `AUTH_COOKIE_SECURE`, recovery TTL, and SMTP settings    |

Setting the URL does not create the frontend route. Do not use an OIDC callback or a browser origin in its place. Links in existing emails are not rewritten by a configuration change.

```dotenv
# Partial production configuration matching the actual frontend pages.
AUTH_COOKIE_SECURE=true
AUTH_ACTIVATION_URL=https://app.example.com/auth/activate
AUTH_RECOVERY_URL=https://app.example.com/auth/reset-password
```

Failure phase: URL format and production requirements are checked at startup; the availability of the frontend page needs separate verification. Sources: [Auth configuration](../../../backend/src/config/auth.config.ts), [recovery service](../../../backend/src/modules/auth/application/password-recovery.service.ts).

## S3 configuration and current wiring {#storage}

### S3_ACCESS_KEY_ID {#s3-access-key-id}

Configure the object-storage access identity paired with `S3_SECRET_ACCESS_KEY`.

| Property                       | Details                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement/input              | Required by current startup configuration validation; nonempty string                                                                    |
| Default/empty/whitespace input | No default; empty input fails; the Schema does not trim, so whitespace can pass min(1) without being a valid credential                  |
| Status/timing                  | StorageConfig is loaded; no business module registers StorageModule in this snapshot; currently validation/storage of configuration only |
| Sensitivity/relationships      | Access identity information; do not publish actual values; related to the secret, endpoint, region, and three buckets                    |

Omission fails startup configuration parsing even while the S3 adapter is unwired. Providing the value does not activate storage, validate identity, create buckets, or configure public access. Once the adapter is activated, verify permissions through the relevant business operation.

```dotenv
# Placeholder requiring deployment-time replacement; this does not prove a valid identity.
S3_ACCESS_KEY_ID=replace-with-provisioned-access-key-id
```

Sources: [Storage configuration](../../../backend/src/config/storage.config.ts), [composition root](../../../backend/src/bootstrap/composition/app.module.ts), [StorageModule](../../../backend/src/infra/storage/storage.module.ts).

## SMTP conditions and defaults {#mail}

In this snapshot, `AuthRecoveryModule` explicitly connects MailModule to typed mail configuration. MailService verifies SMTP connection/TLS/authentication during initialization; verification sends no business email and does not prove inbox delivery.

### SMTP_SECURE {#smtp-secure}

Select whether the connection uses implicit TLS from the beginning.

| Property                  | Details                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Requirement/input         | Optional; only `true` / `false`, parsed as boolean                                                                          |
| Default/empty input       | If omitted, true for `SMTP_PORT=465`, false for other ports; empty input is invalid                                         |
| Constraints/relationships | Port 465 requires true; authenticated connections without implicit TLS require `SMTP_REQUIRE_TLS`; user/pass must be paired |
| Status/timing             | Wired into recovery mail; checked during startup parsing and MailService construction/initialization; nonsecret             |

For a provider's port 587 STARTTLS service, use `SMTP_SECURE=false` and `SMTP_REQUIRE_TLS=true`. MailModule defaults undefined `requireTLS` to true; secure=false alone does not mean TLS is disabled.

```dotenv
# Partial STARTTLS configuration; configure SMTP_HOST, FROM, and required credentials separately.
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
```

An invalid boolean fails typed configuration parsing; invalid 465/authentication/TLS combinations fail adapter options validation; connection failures occur during initialization verify. Sources: [Mail configuration](../../../backend/src/config/mail.config.ts), [effective options and cross-field checks](../../../backend/src/infra/mail/mail.options.ts), [recovery module](../../../backend/src/modules/auth/auth-recovery.module.ts), [MailService](../../../backend/src/infra/mail/mail.service.ts).

### SMTP_MAX_CONCURRENT_SENDS {#smtp-max-concurrent-sends}

Limit concurrent adapter verify/send operations; the name does not restrict counting to the DATA phase.

| Property                  | Details                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Requirement/input/range   | Optional; a string coercible to an integer → number; 1–20                                                          |
| Default and source        | Typed configuration preserves undefined when omitted; MailModule options supply the effective default `3`          |
| Empty input               | Coerces to 0 and fails the minimum constraint                                                                      |
| Status/timing             | Wired into the mail adapter; recovery also reads this setting/default 3 for delivery concurrency; restart to apply |
| Sensitivity/relationships | Nonsecret; related to provider capacity and the six timeout settings                                               |

Increasing the value allows more parallel operations and consumes more connections/resources. The adapter immediately returns busy above its concurrency limit and does not queue internally. Recovery has a separate in-process queue, so the adapter behavior does not establish that all mail use cases are unqueued.

```dotenv
SMTP_MAX_CONCURRENT_SENDS=3
```

Sources: [Mail configuration](../../../backend/src/config/mail.config.ts), [effective options](../../../backend/src/infra/mail/mail.options.ts), [operation scheduling](../../../backend/src/infra/mail/mail.transport.ts), [recovery delivery](../../../backend/src/modules/auth/application/password-recovery.service.ts).

## Lifecycle budgets {#lifecycle}

### SHUTDOWN_TIMEOUT_MS {#shutdown-timeout-ms}

Control the hard process-wide shutdown budget after a stop signal.

| Property               | Details                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Requirement/type/range | Optional; integer milliseconds, 1000–120000                                                                     |
| Default/empty input    | `10000`; empty input coerces to 0 and fails validation                                                          |
| Status/timing          | Wired into process shutdown coordination; parsed at startup, used during shutdown; nonsecret                    |
| Relationships          | HTTP drain, log flush, KVS closing; an external container's stop grace period must allow the budget to complete |

A larger budget allows more cleanup time and extends shutdown duration. Exhaustion follows the failed-shutdown path and does not prove successful adapter cleanup.

### HTTP_DRAIN_TIMEOUT_MS {#http-drain-timeout-ms}

Control the maximum wait for in-flight HTTP requests during shutdown. This differs from the ordinary `REQUEST_TIMEOUT_MS`.

| Property               | Details                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Requirement/type/range | Optional; positive integer milliseconds; no separate field maximum, subject to the combined budget constraint |
| Default/empty input    | `5000`; empty input coerces to 0 and fails validation                                                         |
| Status/timing          | Wired into shutdown; restart to apply; nonsecret                                                              |
| Relationships          | `SHUTDOWN_TIMEOUT_MS` and `LOG_FLUSH_TIMEOUT_MS`; increasing it reduces cleanup time                          |

### LOG_FLUSH_TIMEOUT_MS {#log-flush-timeout-ms}

Reserve bounded time for flushing/closing the log transport at the end of shutdown.

| Property               | Details                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Requirement/type/range | Optional; positive integer milliseconds; no separate field maximum, subject to the combined budget constraint                    |
| Default/empty input    | `500`; empty input coerces to 0 and fails validation                                                                             |
| Status/timing          | Wired into shutdown; restart to apply; nonsecret                                                                                 |
| Relationships          | HTTP drain and the total budget; increasing it reduces time for other phases; bounded flushing does not guarantee remote receipt |

All three inputs must satisfy enforced validation:

```text
HTTP_DRAIN_TIMEOUT_MS + LOG_FLUSH_TIMEOUT_MS < SHUTDOWN_TIMEOUT_MS
```

Equality also fails. Remaining time is available to Nest shutdown hooks and dependency cleanup. `KVS_CLOSE_TIMEOUT_MS` is not included in this validation expression but must fit the actual total budget.

```dotenv
# Partial budget configuration using the current defaults.
SHUTDOWN_TIMEOUT_MS=10000
HTTP_DRAIN_TIMEOUT_MS=5000
LOG_FLUSH_TIMEOUT_MS=500
KVS_CLOSE_TIMEOUT_MS=2000
```

Verification: check integers, units, and the strict inequality, then observe shutdown duration, in-flight requests, cleanup, and logging in an isolated environment. Passing validation does not establish verified shutdown behavior. Sources: [budget validation](../../../backend/src/config/lifecycle.config.ts), [shutdown coordinator](../../../backend/src/bootstrap/lifecycle/shutdown.ts).

## Verification boundary {#verification}

These facts come from configuration, composition, and consumer source code, checked against env key sets. The backend was not started; no real mail, Casdoor/S3 call, or production shutdown was performed. Reconfirm the source version and review date before publishing the formal reference.
