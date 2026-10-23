# WebSocket foundation

## Scope

The API process hosts Socket.IO on its existing Fastify HTTP server: path
`/socket.io`, namespace `/app`, Engine.IO v4. WebSocket and HTTP long polling are
enabled. This is not a raw-WebSocket application protocol. `platform/websocket`
owns the framework/transport boundary; business gateways stay in their owner
module's `api/` directory. There is no Realtime Core or broker adapter.

This slice supplies infrastructure, not a material/inventory subscription API.
The empty platform gateway activates the authenticated namespace without adding
placeholder business events. SSE remains a separate, unimplemented HTTP slice.
There is no frontend connection lifecycle/UI integration until a real consumer
defines its events. Shared contracts are already frontend-consumable.

## Shared public contract

`@talos-ark/contracts/protocol` exports `defineWsRequest`, `defineWsEvent`, wire
schemas, and Socket.IO-compatible `WsClientToServerEvents` /
`WsServerToClientEvents` mapped types. The package depends only on Zod, not Nest
or Socket.IO. Each real domain owns its `*.ws.ts` file and exports it through its
existing package subpath. Definitions and inferred types stay together.

A request has one event name and one JSON envelope:

```ts
{ correlationId: 'caller-generated-id', payload: { /* domain input */ } }
```

It requires a Socket.IO ACK callback. The handler returns unwrapped result data;
the adapter validates the payload, invokes Nest, and sends exactly one ACK:

```ts
{ kind: 'success', correlationId, data, timestamp, context }
{ kind: 'error', correlationId, code, message, details, timestamp, context }
```

Errors before a valid request envelope may lack correlationId. The caller's ID
is correlation only, not idempotency, an actor, or authorization context. Request
IDs are server-generated ULIDs. Handler output must match its declared schema
and its serialized JSON form. Unknown failures become the existing public
internal error. No raw exception/payload/credential is sent or logged.

A server event sends its validated payload directly under its declared event
name. `ws.*` names are reserved. `ws.error` carries the common error schema for
connection-level failures. Domain events must use dotted names and describe an
actual public consumer, not blindly expose internal domain events.

## Gateway integration

The following is an illustrative definition, not an installed business event:

```ts
// packages/contract/src/<owner>/<owner>.ws.ts
export const Echo = defineWsRequest({
    event: 'example.echo',
    payload: z.object({ text: z.string().max(100) }),
    result: z.object({ text: z.string() }),
});
```

```ts
@WebSocketGateway({ namespace: WS_NAMESPACE })
export class ExampleGateway {
    @WsMessage(Echo)
    async echo(
        @WsPayload() input: WsPayloadOf<typeof Echo>,
        @WsContext() context: WsMessageContext
    ): Promise<WsResultOf<typeof Echo>> {
        context.signal.throwIfAborted();
        // Delegate current business authorization and work to the owner service.
        return { text: input.text };
    }
}
```

Register the gateway as an ordinary static singleton Nest provider. Use type
aliases, not DTO classes with a second Zod validation layer. `WsContext` contains
connectionId/userId/sessionId/requestId/correlationId/signal, not a raw socket or
access token. ALS is fresh for each execution; the verified actor is available
to existing services. Nest guards, pipes and interceptors remain available;
the WS filter captures their failures so the adapter still owns the single ACK.
Application HTTP guards, throttling and timeout handling skip WS.

`@WsMessage(contract, { timeoutMs })` may shorten the configured total budget,
never extend it. Do not use `@Ack()`/manual ACKs, return an Observable stream, or
replace the method's WS exception filter. One request returns one result.
Bootstrap checks static gateway scope, namespace/port, contract declarations
and duplicate event names before listening. It does not register contributions
or create another handler discovery mechanism.

## Authentication and browser access

The client uses `handshake.auth: { accessToken }`. Never put tokens in URL query
parameters or use the refresh cookie for WS. The Session kernel verifies current
durable token/session state during handshake and before each business request
and outbound delivery. Only the private connection state retains the token;
`socket.handshake.auth` is cleared after extraction. Business permissions remain
the owning service's responsibility.

The configured HTTP browser origin policy also governs Engine.IO admission,
including direct WebSocket upgrades. CORS alone is not the authorization gate.
No-Origin native clients may connect with a valid token; this is intentional,
not proof that the caller is a trusted browser. The default namespace is denied.

AT expiry sends `ws.error` and disconnects the transport. A revoked session is
rejected on its next request/delivery; there is no revocation subscription yet.
The frontend refreshes through HTTP, replaces auth and explicitly reconnects:
server-initiated disconnect does not automatically reconnect. Automatic write
retries, buffered business-write replay and connection-state recovery are not
part of this foundation.

## Push and rooms

`WsEmitter.emit(contract, payload, { target, authorize })` selects a connection,
user, or server-managed room. Each recipient is reauthenticated and passed to
the caller's authorization callback immediately before delivery. Rooms only
group recipients; joining one never grants permission. `join`/`leave` are
server-only APIs; there is no client-controlled room-join endpoint.

Publishing uses bounded admission and sequential recipient processing. Delivery
does not wait behind the same connection's current inbound handler, so awaiting
a push inside that handler cannot deadlock the inbound queue. Authorization must
honor its AbortSignal and must not recursively enqueue and await a new request.
Pushing uses volatile delivery: a disconnected/non-writable transport is skipped
rather than building an unbounded buffer. `sent` means submitted to a writable
transport, not acknowledged by the browser. Durable notifications/replay and
global ordering across concurrent publications are out of scope.

## Budgets, lifecycle and observation

Inbound messages execute sequentially per connection; different connections may
execute concurrently up to the process cap. Admission bounds pending work both
per connection and globally. A per-connection token bucket covers known and
unknown application events; exhausting it disconnects the connection. Protocol
ping/pong is managed by Socket.IO independently.

JSON messages are bounded by bytes, depth and traversal size; binary/custom
objects are not part of this protocol. ACKs and pushes are bounded too. Total
message timeout starts at admission, including queue waiting. Timeout sends one
error and aborts the cooperative signal, but retains the slot until the actual
operation settles. It does not roll back a committed database write or prove
that no write happened. Owners must provide idempotency/confirmation where needed.

Process shutdown rejects new work, disconnects accepted and unauthenticated
transports, aborts signals and waits for actual executions before closing shared
dependencies. WS and HTTP share the existing HTTP drain budget; uncooperative
work makes drain fail rather than falsely reporting a clean shutdown.

OTel records active connections/handshakes, pending/active messages, rejections,
connection lifetime and per-event duration/outcome. Each message starts a fresh
application span. Labels only use declared event names and fixed outcomes/reasons;
tokens, payloads, user IDs and arbitrary client event names are not metric labels.
Structured diagnostics use the existing error resolver, projectors and log sinks.

## Deployment boundary

This implementation is single-instance. Before 1.0, separately design and verify
the multi-instance adapter, polling affinity, cross-instance delivery/revocation
and distributed quotas. No Redis Pub/Sub or broker is silently provisioned here.
Limits and defaults are listed in `secrets/env/README.md`.

## Verification (2026-10-23)

- Contracts/backend builds, changed-source ESLint, frontend vue-tsc and
  `git diff --check` passed. No test files were added.
- An ephemeral real Nest/Fastify server was exercised with Engine.IO v4 /
  Socket.IO frames over both WebSocket and HTTP polling. Checks covered browser
  origin/CORS, failed handshakes, payload/result validation, successful/error ACKs,
  false-returning Nest guards, unknown events, missing ACK, bounded queues,
  sequential execution, timeout slot retention, push authorization, session
  revocation, token expiry and draining actual in-flight work.
- In-memory OpenTelemetry exporters captured handshake/message spans and all ten
  WS metric instruments, including timeout and active/pending gauges.

The protocol checks used a replacement Session verifier, not a real login or
database. They do not certify production IAM/database wiring, browser UI behavior,
an external OTLP collector or multi-instance behavior. No live business records
were changed by the isolated checks.
