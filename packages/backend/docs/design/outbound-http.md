# Outbound HTTP

## Ownership

`infra/http` owns outbound HTTP execution. `platform/http` remains the inbound
Nest/Fastify boundary. No forwarding-only `core/http` Kernel is introduced.

An owning Infra adapter or module-local infrastructure adapter defines endpoints,
provider credentials, response contracts, pagination and domain error meaning.
Business code calls that adapter, not Axios. `HttpModule` exports
`HttpClientFactory` through explicit Nest imports; it is not global.

The factory creates independent clients, each with its own connection pools,
queue, lifetime and request-singleflight registry. Reuse a configured client;
do not create one per request. Dispose dynamically scoped clients/gates when their
owner is released. The factory also disposes all remaining resources during Nest
module destruction. Limits are per client and per process, not cluster-wide.

## Request contract

```ts
const http = factory.create({
    name: 'provider',
    baseUrl: config.apiRoot,
    timeoutMs: 10_000,
});

const user = await http.request({
    operation: 'user.read',
    method: 'GET',
    path: '/user',
    params: { id },
    signal,
    singleflight: { scope: tenantId, key: `user:${id}` },
    decode: ({ data }) => ProviderUserSchema.parse(data),
});
```

Without `decode`, `request` returns `HttpResponse<unknown>`. It never asserts a
generic `T` over unchecked data. JSON syntax is checked by the HTTP client;
schema/semantic validation remains with the supplied decoder or owning adapter.
Decoder errors retain their original identity. JSON, text and buffered binary
responses are supported; HEAD/204/205 JSON responses yield `undefined`.

Paths begin with one slash and are relative to the configured API root, including
its prefix: `/user` under `https://provider/api` means `/api/user`.
Absolute URLs, path-prefix escapes and URL credentials are rejected. Query values
are serialized independently. Arbitrary Axios options and routing headers cannot
be supplied through the public request contract.

Client defaults are a 30-second total budget, 16 concurrent sends, 128 waiting
requests, and 10 MiB request/response limits. Waiting admission includes credential
and backoff waits, not just the socket queue. Explicit request `timeoutMs` overrides
the caller budget, which covers authentication, queueing, backoff, reading and
async decoding. Shutdown and caller cancellation abort queued or active work;
timers and signal listeners are removed when their scope ends.

GET/HEAD transient failures default to at most three attempts. Other methods and
stream bodies do not replay by default. `replay: 'safe'` is an adapter's explicit
attestation that an operation can repeat safely; it does not make the upstream
idempotent. `replay: 'never'` blocks both retries and 401 replay. A callback cannot
override cancellation, protocol failures or 401/403 retry exclusions.

Retries use capped exponential backoff with jitter (linear is optional).
`Retry-After` is a lower bound; if it exceeds the delay cap, retries stop rather
than sending early. Backoff releases the concurrency slot. A credential recovery
allows at most one additional send, without resetting the transient attempt
budget or total deadline. `retry: false` disables transient retries, not an
explicitly configured credential gate's one safe 401 replay.

## Two kinds of singleflight

Request singleflight is opt-in and only accepts buffered, safely replayable
operations. The client combines the explicit scope/key with method, resolved URL,
body, headers, credential epoch/revision and execution policy identity. A salted
SHA-256 fingerprint prevents raw credential values from becoming registry keys.
Different scopes, request values or policy callbacks do not share a flight.
Never put secrets in caller-provided scope/key or operation labels.

Each waiter has its own cancellation and total budget. Canceling the initiating
waiter does not cancel followers. The producer uses the client timeout and client/
credential lifetime, not the first waiter's deadline. It may finish after every
waiter leaves, but has a finite budget and bounded registry. Completion removes
the entry, including on failure; this is not a cache. Each waiter receives its own
headers/buffer and independently parses/decodes the result.

Credential refresh uses a separate `CredentialGate` per tenant/principal scope.
It stores caller-provided header credentials and expiry; it does not understand
OAuth, passwords, local TalosArk sessions or token storage. The owner supplies
the refresh callback. Concurrent refreshes within one gate share one producer,
with an independent 15-second default deadline. `authWait: 'fail'` skips waiting.
Late 401 responses cannot invalidate newer credentials. Explicit credential
replacement cancels work belonging to the previous epoch, including async decode.

**Refresh must use a separate ungated client.** Authentication waiters intentionally
count against admission; refreshing through the blocked client's own queue can
fail when that queue is full. Create the bootstrap/refresh client separately,
disable its transient retries unless the token protocol permits replay, and pass
the refresh signal through it. Factory-managed gates are aborted at shutdown.

These mechanisms are process-local coordination, not durable idempotency or
distributed refresh locks. Multi-replica refresh-token ownership and atomic token
persistence remain responsibilities of the credential-owning capability.

## SDK and IAM integration

Casdoor receives an adapter through its public `AxiosRequestConfig` constructor
argument. The bridge passes SDK-transformed request bodies through unchanged and
returns raw text/binary for the SDK's one response transform. It retains Axios
response/error conventions and SDK-owned Basic/Bearer credentials, including
`withAccessToken`. It neither patches private fields nor installs global Axios
interceptors. The compatibility path keeps SDK retry/singleflight disabled and
its existing 60-second budget. It supports streamed request bodies but buffered
responses only; legacy `CancelToken` is rejected in favor of native `AbortSignal`.

Standard OIDC PKCE exchange uses the ordinary HTTP client with its existing
10-second budget. Authorization-code exchange explicitly disables retry,
singleflight and replay. Status/body interpretation and existing `IamError`
meaning remain in `IamOidcAdapter`. This change does not introduce refresh-token
storage or replace the current authentication business flow.

AWS S3 keeps its SDK transport/retry mechanisms. Do not wrap it with a second
generic retry layer. Pagination and scheduled polling also stay with their owner,
not with the transport.

## Safety and observability

Clients do not follow redirects and do not consume ambient proxy environment
variables; a deployment proxy must be explicit in client options. Connection
pools and byte limits are client-owned. Configured internal service addresses are
allowed: this is a trusted-upstream client, not an arbitrary-URL fetch service.
Future user-supplied URLs need a separate DNS/IP/redirect-aware SSRF design.

The factory emits debug-level execution observations containing only upstream
name, bounded operation label, send attempts, duration, status and outcome.
These describe transport execution, not decoder/domain success. HTTP errors retain
recognized causes and bounded response bodies for owner-local interpretation,
but observations never include URL/query, headers, tokens, bodies or vendor errors.
The existing terminal boundary remains responsible for error logging. Unknown
configuration/programming failures are not silently reclassified as availability.

The lightweight `common/utils/crypto.ts` SHA-256/random helpers are reused. The generic
`sleep/retry/limit` utilities remain unchanged: they do not provide cancellation,
HTTP replay safety or bounded fair queueing. Cancellable delay uses Node's
`timers/promises`, rather than adding another timer abstraction to `common`.
