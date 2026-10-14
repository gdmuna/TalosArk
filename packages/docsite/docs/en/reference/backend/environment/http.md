---
title: HTTP and Browser Origins
description: HTTP environment variable requirements, types, defaults, origin policy, CORS, throttling, and timeouts
outline: [2, 3]
---

# HTTP and Browser Origins

These settings control browser-origin trust, CORS responses, request throttling, processing timeouts, and the request ID response header. All 10 are wired into the current HTTP pipeline, are nonsecret, and are parsed at startup. Restart the backend after changes.

Code defaults may differ from env example values. In particular, `HTTP_BROWSER_ORIGIN_MODE` defaults to `deny`, while the development example explicitly selects `development-loopback`. See [Loading and Activation](./loading.md) for file precedence and empty-input behavior.

## Variable summary {#variables}

| Variable                                                            | Requirement                | Input and code default                                                  |
| ------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| [`HTTP_BROWSER_ORIGIN_MODE`](#http-browser-origin-mode)             | Optional                   | Enum; `deny`                                                            |
| [`HTTP_BROWSER_ALLOWED_ORIGINS`](#http-browser-allowed-origins)     | Required in allowlist mode | Comma-separated origins; empty list                                     |
| [`CORS_ENABLED`](#cors-enabled)                                     | Optional                   | `true` / `false`; `true`                                                |
| [`CORS_ALLOWED_METHODS`](#cors-allowed-methods)                     | Optional                   | Comma-separated methods; `GET,POST,PUT,DELETE,PATCH,OPTIONS`            |
| [`CORS_ALLOWED_HEADERS`](#cors-allowed-headers)                     | Optional                   | Comma-separated headers; `Content-Type,Authorization,X-TalosArk-Client` |
| [`CORS_PREFLIGHT_MAX_AGE_SECONDS`](#cors-preflight-max-age-seconds) | Optional                   | Nonnegative integer seconds; `86400`                                    |
| [`THROTTLE_TTL_MS`](#throttle-ttl-ms)                               | Optional                   | Integer milliseconds ≥ 1000; `300000`                                   |
| [`THROTTLE_LIMIT`](#throttle-limit)                                 | Optional                   | Positive integer or `Infinity`; `1000`                                  |
| [`REQUEST_TIMEOUT_MS`](#request-timeout-ms)                         | Optional                   | Integer milliseconds, 1000–120000; `30000`                              |
| [`REQUEST_ID_HEADER`](#request-id-header)                           | Optional                   | Header-name string; `x-request-id`                                      |

## Browser-origin policy {#browser-origins}

A browser origin comprises the **scheme, host, and port**, for example `https://app.example.com`. It is not a login callback, activation page, or complete API URL.

::: warning CORS and authentication perform separate checks
CORS middleware and authentication interfaces share the origin policy. Disabling `CORS_ENABLED` skips only CORS middleware. Authentication interfaces calling `AuthHttpSession.assertClient` still require an allowed Origin and `X-TalosArk-Client: browser`.
:::

### HTTP_BROWSER_ORIGIN_MODE {#http-browser-origin-mode}

Select which browser origins the backend trusts.

| Property           | Details                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Raw input → output | Enum string → origin policy object                                                             |
| Accepted values    | `deny`, `allowlist`, `development-loopback`, `development-any`                                 |
| Code default       | `deny`                                                                                         |
| Empty input        | Fails enum validation at startup                                                               |
| Relationships      | `NODE_ENV`, the [origin list](#http-browser-allowed-origins), and [CORS switch](#cors-enabled) |
| Consumers          | CORS middleware and authentication browser-client checks                                       |

| Mode                   | Trust policy                                                                   | Environment constraints                                                          |
| ---------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `deny`                 | Reject requests with Origin; CORS lets general requests without Origin proceed | Available in all environments; authentication client checks still require Origin |
| `allowlist`            | Accept only exact listed origins                                               | Nonempty list; every entry must use HTTPS in production                          |
| `development-loopback` | Accept `localhost`, `127.0.0.1`, and `[::1]`, including different ports        | Only `NODE_ENV=development`                                                      |
| `development-any`      | Accept any valid HTTP(S) origin                                                | Development only; expands trust and logs a startup notice                        |

Changing only the origin list does not change the mode. A development mode in test/production fails startup parsing. Allowlist matching rejects unmatched origins; similar domain names do not imply trust.

### HTTP_BROWSER_ALLOWED_ORIGINS {#http-browser-allowed-origins}

Declare trusted browser sites for allowlist mode.

| Property                | Details                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Raw input → output      | Comma-separated string → origin array; entries are trimmed and empty entries removed |
| Format                  | Exact canonical HTTP(S) origin, with no path, query, fragment, or trailing `/`       |
| Code default            | Empty string, parsed as `[]`                                                         |
| Conditional requirement | At least one entry when `HTTP_BROWSER_ORIGIN_MODE=allowlist`                         |
| Empty/whitespace input  | Produces an empty array; startup fails in allowlist mode                             |
| Relationships           | Origin mode, `NODE_ENV`, and actual frontend site addresses                          |

Wildcards, domain suffixes, and URLs with paths are unsupported. `https://app.example.com` is valid; `https://app.example.com/`, `https://app.example.com/auth`, and `*.example.com` are invalid.

Other modes do not use the list to decide trust, but every supplied entry still undergoes format validation. The additional production HTTPS constraint applies when the mode is allowlist.

Verification: inspect the browser request's Origin and compare scheme, host, and port. Do not fill the list with the full page URL from the address bar.

## CORS protocol responses {#cors}

### CORS_ENABLED {#cors-enabled}

Control whether CORS middleware handles protocol responses and origin filtering.

| Property                   | Details                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Raw input → output         | Only strings `true` / `false` → boolean                                               |
| Code default               | `true`                                                                                |
| Empty and invalid examples | Empty input, `1`, and `TRUE` fail startup parsing                                     |
| Relationships              | Origin policy, allowed methods/headers, and preflight cache                           |
| Disabled behavior          | Middleware proceeds directly, omitting its CORS response headers and origin filtering |

When enabled, valid requests with Origin receive the matching `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`. Disabling it leaves authentication origin/client-header requirements intact and does not grant browsers permission to read cross-origin responses.

### CORS_ALLOWED_METHODS {#cors-allowed-methods}

Configure `Access-Control-Allow-Methods` in OPTIONS preflight responses.

| Property           | Details                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| Raw input → output | Comma-separated string → method array; entries are trimmed and empty entries removed |
| Code default       | `GET,POST,PUT,DELETE,PATCH,OPTIONS`                                                  |
| Empty input        | Empty string falls back to the default array                                         |
| Whitespace only    | A nonempty original string can produce `[]` without falling back                     |
| Validation         | The Schema does not check standard HTTP method names or require a nonempty list      |
| Relationships      | `CORS_ENABLED`, frontend request methods, and registered routes                      |

Adding a method changes only preflight responses. It creates no backend route and authorizes no operation. Use standard methods actually needed by the frontend; code does not correct spelling or casing.

Verification: send OPTIONS from an allowed origin, inspect the allowed methods, then confirm that the actual route exists.

### CORS_ALLOWED_HEADERS {#cors-allowed-headers}

Configure `Access-Control-Allow-Headers` in OPTIONS preflight responses.

| Property           | Details                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| Raw input → output | Comma-separated string → header array; entries are trimmed and empty entries removed |
| Code default       | `Content-Type,Authorization,X-TalosArk-Client`                                       |
| Empty input        | Empty string falls back to the default array                                         |
| Whitespace only    | Can produce an empty array without falling back                                      |
| Validation         | The Schema does not validate HTTP token syntax or require a nonempty list            |
| Relationships      | CORS switch, actual frontend request headers, and authentication client header       |

List custom headers used by cross-origin frontend requests. Retain `X-TalosArk-Client` when required by browser authentication. Request-header permission is different from exposing response headers; this setting does not generate `Access-Control-Expose-Headers`.

Verification: compare the preflight request's `Access-Control-Request-Headers` with the response's allowed list. This list does not validate or authorize the header contents for business interfaces.

### CORS_PREFLIGHT_MAX_AGE_SECONDS {#cors-preflight-max-age-seconds}

Set `Access-Control-Max-Age` in OPTIONS responses so browsers may cache successful preflights.

| Property           | Details                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| Raw input → output | A string coercible to an integer → number                              |
| Unit and range     | Seconds, integer ≥ 0; no separate Schema maximum                       |
| Code default       | `86400`, or 24 hours                                                   |
| Empty input        | Coerces to 0 and passes instead of using the default                   |
| Relationships      | CORS switch, browser preflight cache, and method/header policy changes |

A larger value reduces repeated preflights but may delay clients checking updated permissions; 0 requests no preflight caching. Browsers may impose their own cache limit, so the response value does not guarantee the actual cache duration.

Verification: inspect the OPTIONS response header. If a recent policy update appears ineffective, also consider existing browser cache.

## Throttling and request processing {#request-processing}

### THROTTLE_TTL_MS {#throttle-ttl-ms}

Set the counting window for the current default ThrottlerGuard. Authentication account/IP attempt windows are configured independently.

| Property           | Details                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Raw input → output | A string coercible to an integer → number                                                    |
| Unit and range     | Milliseconds, integer ≥ 1000; no separate Schema maximum                                     |
| Code default       | `300000`, or 5 minutes                                                                       |
| Empty input        | Coerces to 0, below the minimum; startup parsing fails                                       |
| Relationships      | [Request count limit](#throttle-limit) and authentication-specific attempt limits            |
| Consumer           | Default throttler registered in AppModule; routes/classes may explicitly override or skip it |

At an unchanged count limit, a longer window generally makes sustained traffic more likely to reach the limit. The default tracker comes from client IP, normalized by the library; keys also include the controller, handler, and throttler name. This is neither one shared site-wide counter nor a business-account counter.

Verification: repeatedly call the same route in an isolated environment and inspect throttling responses and retry information. Do not merge this setting with `AUTH_ATTEMPT_WINDOW_SECONDS`.

### THROTTLE_LIMIT {#throttle-limit}

Set the request count limit within the default throttling window.

| Property           | Details                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| Raw input → output | Positive integer string → number; special value `Infinity` → numeric Infinity  |
| Accepted values    | Integer ≥ 1, or exactly cased `Infinity`                                       |
| Code default       | `1000`                                                                         |
| Empty input        | Coerces to 0 and fails startup parsing                                         |
| Relationships      | Throttling window, route overrides, and authentication-specific attempt limits |

A smaller value triggers default throttling sooner. `Infinity` removes the finite count bound from this default limit; it does not disable business authentication limits, origin checks, or request timeouts. Explicit route/class overrides or skips still affect behavior.

```dotenv
# Partial default-throttler settings; authentication-specific limits remain independent.
THROTTLE_TTL_MS=300000
THROTTLE_LIMIT=1000
```

### REQUEST_TIMEOUT_MS {#request-timeout-ms}

Control how long the global TimeoutInterceptor waits for an HTTP processing result.

| Property           | Details                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Raw input → output | A string coercible to an integer → number                                                          |
| Unit and range     | Milliseconds, integer 1000–120000                                                                  |
| Code default       | `30000`, or 30 seconds                                                                             |
| Empty input        | Coerces to 0 and fails startup parsing                                                             |
| Relationships      | Independent downstream HTTP/SMTP/database deadlines and cancellation; distinct from shutdown drain |

A shorter timeout ends the wait sooner; a longer value permits more processing time. The interceptor maps RxJS TimeoutError to a request processing timeout error.

::: warning Timeout does not prove downstream effects were rolled back
An HTTP wait timeout does not automatically establish cancellation of database work, email sending, or outbound HTTP. Confirm cancellation signals passed by the use case or adapter-specific deadlines.
:::

This is not the reverse proxy's connection timeout or shutdown's `HTTP_DRAIN_TIMEOUT_MS`. Verify a known slow request in an isolated environment, inspecting both the response and downstream results.

### REQUEST_ID_HEADER {#request-id-header}

Name the response header containing the backend request ID.

| Property               | Details                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| Raw input → output     | String → lowercase header name                                            |
| Code default           | `x-request-id`                                                            |
| Empty/whitespace input | Preserved; the Schema checks neither nonempty input nor HTTP token syntax |
| Relationships          | Fastify request ID generation, response tracing, and log correlation      |
| Consumer               | Request preprocessing calls `res.setHeader(name, req.id)`                 |

Fastify currently generates request IDs using ULID. This setting changes only the response header name. It does not select a client header for receiving IDs or change the generation algorithm.

Retain the default or choose a valid header name. Empty or invalid syntax may fail only when the response header is written; successful configuration parsing does not prove header validity.

Verification: inspect actual response headers. Cross-origin JavaScript access to custom response headers also depends on exposure policy; neither this variable nor `CORS_ALLOWED_HEADERS` configures an exposure list.

## Configuration examples {#examples}

These are **partial snippets**. Retain database, KVS, keys, Casdoor, and other current required startup settings.

### Local frontend development {#local-development}

Use this when the frontend runs on a loopback address and the backend is in development. The example frontend address is `http://localhost:4444`.

```dotenv
NODE_ENV=development
CORS_ENABLED=true
HTTP_BROWSER_ORIGIN_MODE=development-loopback
REQUEST_TIMEOUT_MS=30000
```

This mode trusts other loopback ports as well; supplying an origin list does not narrow it. To allow only that exact address, select allowlist instead:

```dotenv
HTTP_BROWSER_ORIGIN_MODE=allowlist
HTTP_BROWSER_ALLOWED_ORIGINS=http://localhost:4444
```

### Production browser access {#production-browser}

Replace origins and authentication pages with actual deployment addresses. Authentication pages are complete page URLs; the origin list contains only origins.

```dotenv
NODE_ENV=production
CORS_ENABLED=true
HTTP_BROWSER_ORIGIN_MODE=allowlist
HTTP_BROWSER_ALLOWED_ORIGINS=https://app.example.com
AUTH_COOKIE_SECURE=true
AUTH_ACTIVATION_URL=https://app.example.com/auth/activate
AUTH_RECOVERY_URL=https://app.example.com/auth/reset-password
```

HTTPS origins, Secure cookies, and HTTPS activation/recovery pages are currently enforced in production. Actual frontend requests, cookie behavior, and page routes still need verification.

## Troubleshooting by symptom {#troubleshooting}

| Symptom                                         | Check first                                             | How to distinguish the cause                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Origin configuration fails startup              | Mode, list, and `NODE_ENV`                              | Development mode outside development; empty or malformed allowlist; non-HTTPS production entries                     |
| Browser request is rejected with 403            | Actual Origin, policy, and authentication client header | Compare the origin; interfaces requiring a client check also need `X-TalosArk-Client: browser`                       |
| Browser blocks the call after preflight         | Allowed methods/headers and cache                       | Compare OPTIONS request and response; account for cached preflights after changes                                    |
| Throttling occurs earlier than expected         | TTL, LIMIT, and route declarations                      | Check count/window for the same client tracker and route; inspect authentication attempt limits separately           |
| Request times out but downstream work continues | Request timeout and downstream cancellation/deadlines   | Inspect response timing and business adapters independently; HTTP timeout does not establish cancellation            |
| Request ID response header is missing or fails  | Header name and proxy behavior                          | Check empty input, valid syntax, and actual response; cross-origin JavaScript access also depends on exposure policy |

<details>
<summary>Implementation sources and review date</summary>

Reviewed on 2026-10-14 against the development working tree. Configuration and defaults come from `packages/backend/src/config/http.config.ts`; origin matching is in `src/platform/http/browser-origin.policy.ts`.

Consumers include `src/platform/http/middleware/cors.middleware.ts`, `src/modules/auth/api/auth-http-session.ts`, `src/platform/http/interceptors/timeout.interceptor.ts`, and `src/platform/http/middleware/request-preprocessing.middleware.ts`. Composition and request ID generation are in `src/bootstrap/composition/app.module.ts` and `src/bootstrap/bootstrap.ts`. Default tracking keys were checked against the installed `@nestjs/throttler` implementation.

The reference was verified against source. Documentation builds and browser reading checks do not establish real backend request or production deployment verification.

</details>
