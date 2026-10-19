# Frontend API Platform

Date: 2026-10-08

## Scope

This implements the HTTP/auth portion of the approved frontend restructuring, rather than creating a second business model beside the backend.

- Build the reusable execution layer and the typed business API layer.
- Migrate the two actual OIDC consumers away from direct Axios calls.
- Retire the unused legacy `shared/api` files, with explicit user approval.
- Keep account, workspace and workbench on their existing mock data sources.
- Do not change the backend or invent its missing resource/refresh contracts.
- Do not add or maintain test scripts during the current rapid-iteration phase.

## Ownership

```text
main.ts                         composition, dependency injection, disposal
  platform/http/
    client.ts                   transport, auth/retry execution, envelope decoding
    auth-gate.ts                single-flight barrier and session-generation isolation
    retry.ts                    bounded linear/exponential backoff, jitter, Retry-After
    pagination.ts               cursor/offset-neutral page traversal
    error.ts                    HTTP and authentication error types
    type.ts, index.ts           public contract
  platform/task/
    abort.ts                    cancellation, deadline, delay, independent waiting
    scheduler.ts                owned, completion-based periodic task maintenance
    index.ts                    public contract
  module/auth/
    data/source.ts              typed authentication I/O interface
    data/api.ts                 confirmed OIDC HTTP endpoints, no session writes
    model/auth.ts               login-result ordering and local sign-out
    model/session.ts            credentials, refresh validation and in-memory ownership
    model/context.ts            Vue injection of business operations
    factory.ts, index.ts        composition and compatible public entry
```

The dependency direction is `application -> module/auth -> platform/http -> platform/task`. `platform/http` never imports `module/auth`, router or a store. Main composes the auth gate and client; the auth module supplies the actual session semantics. ESLint now enforces platform public entries and the sole cross-platform dependency `http -> task`.

Future material/inventory APIs belong in their business module, with an HTTP data-source adapter selected by main when replacing a mock source. Do not expose Axios to views, move resource models into platform, or collect unrelated endpoints in a global API barrel.

### Alignment with Other Modules

The first auth implementation drifted from the approved module structure: flat root files and a combined transport/state-mutating API. This has been corrected rather than making the existing account/workspace/workbench modules copy that exception.

All modules follow the same responsibility split: data sources own external I/O; models own business state and operations; the application/public factory composes them; consumers use the public entry. Models import the source contract, never a concrete adapter. The architecture rule now enforces this last constraint.

Auth does not need a Pinia store solely for symmetry. Its current state is a private credential runtime plus in-flight login ordering, not a shared observable view model. Tokens stay outside serializable Pinia state. Pinia remains appropriate for the existing account/workspace/workbench view state; model ownership does not prescribe one state framework.

`createAuthApi(http, session)` remains the same public business facade, composed by a small factory. Its HTTP data source no longer accepts or writes a session; `model/auth.ts` validates login input before advancing its request revision, calls the source, rejects stale responses and commits successful credentials. Existing function signatures, injection key, auth policies and disposal behavior are unchanged. No compatibility overload, second auth store or empty mock/UI directory was introduced.

## HTTP Execution

`createHttpClient({ baseUrl, auth, timeoutMs, retry })` returns `request()` and `dispose()`.

Each request declares a method, a module-owned relative path and a Zod response schema. The payload type is inferred from the schema, not asserted through `get<T>()`. The client validates the shared response envelope before decoding its data. JSON-envelope APIs are supported; raw downloads, bodyless HEAD requests and third-party origins are intentionally outside this interface.

- API paths cannot escape the configured root or replace its origin. Main uses the existing full API URL, including `/api/v1`.
- Cookies remain enabled for the existing OIDC transaction flow.
- Protected requests are the default. Public auth endpoints explicitly use `auth: 'none'`, which neither waits for refresh nor attaches a bearer token.
- Caller-supplied authorization headers are removed; the gate exclusively supplies credentials.
- The default 30-second deadline includes queue waiting, transport and retry backoff. Cancellation interrupts all these phases.
- Disposal stops outstanding execution. Main disposes on app unmount and HMR replacement.
- `HttpError` distinguishes transport, HTTP, API and protocol failures and retains the API code, request ID, details and cause when present. Caller cancellation/deadline reasons remain abort/timeout errors.
- Success calls return the validated payload, not the envelope. Successful-response context is not presently exposed because no consumer needs it.

## Authentication Barrier

`createAuthGate()` stores only an access credential and generic execution state. `createAuthSession()` owns the full `SessionCredentials` contract in memory. Neither uses persistent browser storage.

Execution:

1. Before transport, a protected request acquires an access lease.
2. Expired credentials or a protected 401 trigger a shared refresh operation.
3. During that operation, new protected requests wait on the same Promise. This is a barrier, not a serial network queue: released requests may execute concurrently.
4. A successful refresh resumes requests with the new token. A request can replay after 401 at most once; a second 401 invalidates that token instead of looping.
5. Refresh failure or a missing adapter clears the credential and releases waiters with an error. No indefinite wait for an interactive login is introduced.

Separate counters represent session identity and token revision. Explicit login replacement/local sign-out changes identity and cancels old-session requests, including their backoff and transport. A token refresh changes only revision. A late 401 from the old token therefore reuses the newer credential without launching another refresh or expiring the new token. A late refresh after sign-out cannot restore a session.

A waiting request can cancel independently without canceling everybody's refresh. Refresh itself has a separate 15-second deadline and is canceled by session replacement/disposal. Custom refresh providers must honor their signal; when using this HTTP client, the refresh transport must use `auth: 'none'` to avoid waiting on itself. An aborted/misbehaving provider cannot commit a late credential.

The auth module additionally validates refreshed credentials and checks that session/user identity is preserved. Local sign-out also invalidates pending OIDC callbacks so they cannot restore credentials or report stale login success.

### Current Backend Limit

The backend has complete shared schemas only for `POST /auth/oidc/start` and `POST /auth/oidc/login-callback`. The callback returns access and refresh tokens in the response body. The frontend retains them only in memory and accepts them after shared-schema validation.

`POST /auth/session/refresh` and `POST /auth/session/logout` currently throw 501, and refresh has no request/response contract. Main consequently calls `createAuthSession()` without a refresh adapter. The reusable single-flight machinery is implemented and verified, but **live automatic renewal is not enabled**. An expired/rejected credential fails closed. Page reload does not restore login; this requires a confirmed backend restoration contract.

`clearLocalSession()` clears client credentials and cancels protected work, then the existing menu returns to login. It is deliberately not named `logout()` and does not claim to revoke a backend session. Server revocation, restoration and routing guards require a subsequent backend-integrated slice.

## Customization Decisions

| Policy | Downstream control | Reason |
| --- | --- | --- |
| Retry | Disable, linear/exponential backoff, attempt limit, base/max delay, eligibility callback | Different read operations have different latency and failure tolerance. |
| Total deadline/cancellation | Per request | Ownership and latency vary by caller. |
| Refresh waiting | `wait` or `fail` | Background work may prefer immediate failure; foreground reads can wait. `fail` does not send stale credentials or bypass a pending refresh. |
| Public/protected endpoint | Fixed by business adapter | This is endpoint semantics, not a view preference. API option objects cannot override an adapter's method/path/schema/auth choice. |
| Actual refresh implementation | Injected by auth composition | Platform must not own TalosArk auth endpoints or credential contracts. |
| Single-flight/session isolation/one 401 replay | Not switchable | These are consistency and safety guarantees, not styling or performance preferences. |
| Response schema validation | Required | Compile-time types alone do not validate server output. |
| Scheduled cadence/error continuation | Configurable | Modules own their polling needs and error policy. |
| Authentication bypass in protected operations | Not provided | Fail-fast means fail, not silently send anonymously. |

Retry defaults to up to three transient-failure attempts for GET, excluding the separate single authentication replay, with 300ms exponential base delay, 10-second cap and jitter. Network failures and 408/429/502/503/504 are retryable by default. Protocol failures, 401 and 403 cannot be made retryable through the callback. `Retry-After` is a lower bound; when it exceeds the configured cap the client fails rather than retrying earlier than requested.

`RetryPolicy.backoff` selects `'linear'` or `'exponential'` (the unchanged default), at either client or request level. With failed attempt number `n` starting at 1, linear uses `baseDelayMs * n` and exponential uses `baseDelayMs * 2 ** (n - 1)`. Before jitter/capping, a 300ms base gives `300, 600, 900, 1200` for linear versus `300, 600, 1200, 2400` for exponential. Both retain the existing 50%-100% jitter, cap, cancellation and server delay lower bound. The first two delays coincide, so the default three-attempt budget alone does not visibly distinguish them.

Writes do not automatically retry transient/network failures, even with a custom policy. A client timeout, network break, HTTP 504, or invalid response after sending a write does not prove the server operation was canceled or rolled back; local `AbortSignal` cancellation is not proof either. Treat these outcomes as unconfirmed, reload and inspect current state before deciding whether to submit again. Inventory P09 operations can reuse the same idempotency key or query their operation receipt. Other writes have no general receipt or deduplication contract, so do not blindly resubmit them. Support for automatic retries requires a confirmed server-side deduplication contract, not a generic `retry: true` switch. A single auth replay is separate and relies on the backend rejecting unauthorized requests in its guard before executing business operations. OIDC start/callback never retry because their cookie/authorization-code flow has side effects and single-use semantics.

## Pagination and Scheduling

`createPagination({ first, load })` wraps a business-owned loader. Its normalized `Page<T, Cursor>` has `items`, `nextCursor` and optional `total`. A module maps a confirmed backend offset/cursor response to this shape; it is **not** a new shared wire contract. Cursors support strings or numbers, so offset-based loaders can use numeric cursors.

The wrapper supplies a default limit of 20, checks positive integer limits, supports cancellation, exposes single-page loading and lazy async page traversal, and detects repeated cursors. It has no Vue state, table coupling, automatic whole-dataset accumulation or invented material endpoint.

`createTaskScheduler()` registers tasks by unique ID and returns handles with `stop()`, `done` and `lastError`. Only one invocation of a task runs at a time; the interval is measured after completion, not by a competing setInterval. Duplicate IDs fail explicitly. Failures stop by default; `onError` may explicitly request continuation. Observer failures are recorded as `lastError`. Disposal aborts active work and prevents new registrations.

Business modules own scheduler lifetime and must stop/dispose it at their owner boundary. Their task forwards the supplied signal to its API request, automatically inheriting the same retry/auth behavior. No polling job is enabled just because the primitive exists. Tasks must cooperate with cancellation to stop their underlying side effects; a scheduler cannot forcibly cancel arbitrary JavaScript work.

## Verification and Retirement

- Baseline type check: 10 source missing-schema errors plus 11 obsolete-test errors.
- After retirement and implementation: no production-source type errors; full type check reports 31 obsolete-test errors (the original 11 plus 20 newly unresolved references to the explicitly retired legacy API). Tests and compiler inclusion were not rewritten to hide this.
- Source lint, formatting and production Vite build checked separately. Concurrent user changes to Workbench.vue were preserved.
- Disposable, in-memory runtime probes cover single-flight waiting, isolated cancellation, fail-fast, stale 401, session replacement, retry/write safety, schema failures, Retry-After, deadlines, URL containment, non-overlapping scheduling and pagination cycle detection. No maintained test file was added.
- These probes exercise real transport against a temporary local HTTP server, not a working TalosArk refresh endpoint. No live login/provider integration or server logout is claimed.

Retired paths: all unused `src/shared/api/module/*` adapters and their old client/token implementation. Source consumers were only the auth route views; both now use the provided auth API. External code importing these private legacy paths must migrate; compatibility stubs were intentionally not retained.

## Primary References

- [Axios request configuration](https://axios-http.com/docs/req_config): configured transport and URL handling.
- [Axios cancellation](https://axios-http.com/docs/cancellation): AbortSignal-based transport cancellation.
- [RFC 9110, idempotency](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): retry safety and non-idempotent operations.
- [RFC 9110, Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3): delay hints from the server.
