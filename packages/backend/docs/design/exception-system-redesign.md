# Exception System

Status: implemented, 2026-10-08. This replaces the previous exception hierarchy
and import-side-effect registry outright. There is no compatibility facade.

## Ownership

```text
SDK failure
  -> Infra native Error + technical failure + private cause
  -> Core native Error when the operation gives it a different meaning
  -> module API mapper
  -> channel-neutral ErrorResolver (schema validation / safe fallback)
  -> HTTP status policy + filter OR WS error message adapter
```

Errors belong to their actual owner. There is no `common/error`, universal Result
type, empty subclass per code, or global business failure enumeration. An Infra
implementation may use ALS/Pino, but neither its native error nor Core's error
knows application HTTP statuses, response envelopes or documentation URLs.

Business anomaly/reminder records remain business data, not thrown exceptions.
This work does not implement the risk subsystem or future inventory/approval
business slices.

## Source Map

```text
packages/backend/src/
  bootstrap/composition/error.provider.ts
  core/identity/identity.error.ts
  core/access/access.error.ts
  infra/database/prisma/prisma.error.ts
  infra/iam/iam.error.ts
  infra/kvs/kvs.error.ts
  infra/storage/storage.error.ts
  modules/auth/api/
    auth.error-mapper.ts
    auth.http-error.ts
  platform/error/
    access.error-mapper.ts
    error.definition.ts
    error.resolver.ts
    request.error.ts
    request.error-mapper.ts
  platform/http/error/
    http-error.normalize.ts
    http-error.policy.ts
    http-error.filter.ts
  platform/http/guards/auth.error.ts
  platform/http/route/
    route.contract.ts
    route.openapi.ts
    route.guard.ts
    route.interceptor.ts
    route.response.ts
  platform/realtime/websocket/ws-error.adapter.ts
  platform/context/response-context.ts
  platform/observability/error-serializer.ts

packages/contract/src/
  protocol/context.ts
  protocol/error.ts
  protocol/http.ts
  protocol/websocket.ts
  auth/error.ts
```

`ErrorDefinition` pairs a public wire contract with a fixed message and logging
level. A module mapper returns this definition and safe details, or `undefined`
when it does not own the error. `ErrorResolver` tries the explicitly composed
mappers, validates details with the definition's schema, then validates the
public content as JSON and checks actual JSON serialization (recursive schemas
can accept cycles). Unknown failures, invalid mappings, mapper exceptions,
and non-Error throws become `SYS_INTERNAL_ERROR` with null details.

Private `original` and `mappingError` are retained for the transport's logger;
they are never spread into a public response. Cause chains are not traversed to
find a convenient business mapping: the outer error owns the caller-facing
meaning, and a programmer defect must not become a business success or retry.

## Reframing Rules

- Prisma recognizes SDK request/initialization failures. Unique constraints keep
  model/field/index evidence; not-found, transaction-conflict, unavailable,
  configuration and query-failed are distinct technical outcomes. Identity only
  maps the known User email/username and ExternalIdentity issuer/subject
  constraints to business conflicts. Unknown unique violations stay internal.
- `PrismaService.execute` wraps an awaited operation. For batch transactions,
  construct the lazy PrismaPromises first, then wrap `$transaction` itself.
  Never turn each transaction member into an eagerly awaited ordinary Promise.
  Repository read/write methods return normalized ordinary Promises; they are
  not a source of lazy batch members.
- IAM distinguishes rejected grants, unavailable upstream, invalid responses and
  configuration. Known invalid JWTs still return null. Bad verifier configuration
  or unexpected failures do not masquerade as invalid credentials. Token-body
  read failures are classified separately from malformed JSON. The standard
  token exchange has a bounded network deadline and no automatic replay/retry.
- KVS recognizes connection/offline/network errors separately from command
  errors. Only unavailable dependencies become Identity's login-unavailable.
  Missing/consumed transactions and state mismatches become transaction-invalid.
- Access maps database availability to session-unavailable. Required and optional
  authentication both propagate dependency failures; neither treats an outage as
  a valid anonymous authentication result. Inactive sessions and reused refresh
  tokens have separate failure reasons. Conditional update misses during rotation
  become session-inactive, without retrying the security-sensitive operation.
- Storage normalizes S3/credential/network failures. Missing objects and missing
  buckets are different. `objectExists` returns false only for a missing object;
  other failures propagate. Missing response bodies/upload IDs and partial batch
  deletion are errors rather than false successes. Download stream errors are
  normalized when consumed, not only when the initial SDK request completes.
- Unrecognized errors remain intact. There is no global `retryable` flag or
  automatic retry: safety depends on the concrete operation and side effects.

## HTTP

One global `HttpErrorFilter` handles the boundary. Framework normalization
recognizes Nest request rejections, Throttler and Fastify parser errors. Inbound
Zod validation becomes `REQUEST_VALIDATION_FAILED`; outbound serialization
failure stays an internal error. Arbitrary SDK messages and HttpException
response objects are never echoed.

```json
{
  "success": false,
  "code": "AUTH_OIDC_TRANSACTION_INVALID",
  "message": "Login transaction is invalid or expired",
  "details": null,
  "type": "https://example.test/errors#auth-oidc-transaction-invalid",
  "timestamp": "2026-10-08T00:00:00.000Z",
  "context": { "requestId": "request-1", "time": 1791417600000 }
}
```

`HttpErrorPolicy` binds definitions to statuses separately. Composition rejects
duplicate codes/invalid statuses; a missing binding falls back to internal 500.
The filter logs before checking whether headers were sent, and never sends a
second envelope. Existing Throttler `Retry-After` headers survive. CORS early
rejections also use the error policy and envelope rather than a separate shape.

Request processing timeout is 504, not a claim that the underlying operation was
aborted or rolled back. Security-sensitive operations are not automatically
retried. Request failure logs use the route pattern, not raw query strings.

`ApiRoute.errors` accepts explicit HTTP bindings, not registered code strings.
The route's compiled status schemas supply both OpenAPI alternatives and runtime
validation of complete response envelopes. Route bindings select the HTTP status
for matched endpoints; global bindings cover pre-route failures. An undeclared
error becomes a documented internal `500`. There is no discovery order,
unknown-code skip, generic error-schema overwrite or success-schema postprocessor.

Access error mapping now lives in Platform alongside its cross-domain guard,
instead of depending on the Auth business module. Auth and WS reuse the same
mapper; public codes and messages are unchanged. Required/optional authentication
automatically declare session-service outages. See `api-route.md` for the route
contract, success-status selection and validation lifecycle.

## WebSocket

`WsErrorAdapter.createResponse(error, context, correlationId?)` uses the same
resolver and returns `{ message, error }`. Send only `message`; `error` is private
diagnostic state for the gateway's terminal logging boundary.

```json
{
  "kind": "error",
  "correlationId": "command-1",
  "code": "AUTH_OIDC_TRANSACTION_INVALID",
  "message": "Login transaction is invalid or expired",
  "details": null,
  "timestamp": "2026-10-08T00:00:00.000Z",
  "context": null
}
```

The message has no HTTP status, header or documentation URL. A WS adapter
validates its incoming payload and constructs RequestError with the shared
`validationIssues` helper. An unexpected raw Zod error is not automatically
assumed to be a client mistake. Register/export the adapter through the actual
gateway's Nest composition when that slice is introduced. No gateway, socket
server, socket close-code policy or WS business operation has been implemented.

## Observability and Privacy

- nestjs-pino is the only application logging pipeline. Pino HTTP serializer
  wrapping is disabled so the allowlisted serializer receives actual Error
  instances instead of pre-serialized vendor data.
- Terminal transport failures are logged once. Rethrowing adapters do not also
  log a command failure. Connection lifecycle events and performance metrics
  remain separate events.
- Diagnostics retain type, safe code/reason/operation, upstream status and stack
  frames, with a maximum cause depth and circular-cause protection. Arbitrary
  messages, SDK properties, payloads, tokens, cookies, SQL and bindings are omitted.
- Aggregate failures retain a bounded number of sanitized children. Startup and
  cleanup failures are both retained rather than letting cleanup mask the cause.
- Startup failure remains process-owned and exits nonzero; ordinary request
  defects log at error level rather than pretending the process is fatal.
- Public context is explicitly projected to requestId/time/version/userId.
  Internal ALS metadata is private in both successful and failed responses.

## Adding an Actual Business Error

1. Define a native error/failure value beside its owner; preserve cause when
   reframing an actual dependency failure.
2. Add a literal public code and safe details schema to the owning contract area.
3. Add a module API mapper; define HTTP bindings separately if the module has an
   HTTP interface.
4. Compose the mapper/bindings in `error.provider.ts`, and declare applicable
   bindings on the route. WS reuses the neutral mapper without HTTP dependencies.
5. Check unknown/error mapping fallback, safe details, and the operation boundary.

## Verification and Limits

Verification uses builds, static checks and disposable inline behavior probes,
not added/maintained test scripts under the current iteration policy. Checks
cover shared HTTP/WS resolution, SDK classifications, Nest/Fastify request
handling, safe Pino output and full AppModule composition with external adapters
replaced. This is not a live Casdoor/Prisma/Valkey/S3 end-to-end acceptance run.

Session refresh/logout HTTP actions remain explicitly not implemented (501).
No database schema synchronization, migration, seed, future business endpoint or
frontend refactor is part of this work. Existing multipart presign construction
is outside the error redesign and is not claimed to be a validated upload flow.
