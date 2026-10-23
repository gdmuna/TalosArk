# Shared WebSocket contracts

Status: accepted and implemented as a foundation, without business event consumers.

## Decision

- Use Socket.IO through the NestJS 11 adapter on the existing Fastify HTTP server.
  The application namespace is `/app`; the transport path is `/socket.io`.
- Public schemas, event names and inferred types belong in `packages/contract`.
  Common request/ACK/error helpers live in `protocol/websocket.ts`; real business
  definitions belong in each owning domain's `*.ws.ts` and its public subpath.
- Contracts remain framework-independent and only depend on Zod. Derivable
  Socket.IO event-map types do not require the client/server SDK at runtime.
- The backend's `platform/websocket` owns authentication, ALS, transport budgets,
  ACKs, cancellation and observability. Gateway handlers delegate business work
  and current permissions to application services. Rooms are not authorization.
- Remove the unused generic Realtime Core/Infra layer. SSE is an independent HTTP
  transport, not an alternate implementation hidden behind a Realtime Kernel.

## Consequences

Frontend consumers can import the same definitions for static types and runtime
validation. This foundation does not invent business events or activate a
frontend connection before a real consumer exists. Push is bounded, best-effort
delivery; durable replay, automatic write retries and cross-instance transport
adapters are not implied. Multi-instance support must be addressed before 1.0.

Backend integration and operational boundaries:
[`websocket.md`](../../packages/backend/docs/design/websocket.md).
