# Exception System

Implemented design, 2026-10-09. Replaces the earlier owner-written error classes,
public mapper chain and duplicated HTTP binding tables. No compatibility facade.

## Ownership and Flow

```text
SDK failure
  -> Infra normalizer -> factory-managed technical Error
  -> owner-local semantic mapper -> capability/module Error when meaning changes
  -> selected catchError recovery OR propagation to the response boundary
  -> ErrorResolver: scope.reason catalog lookup + public details validation
  -> HTTP policy/filter OR WS adapter: protocol + complete wire validation
  -> terminal logger consumes library-neutral, sanitized diagnostics
```

Business anomalies/reminders are persisted business data, not thrown exceptions.
This design does not implement future inventory/approval/risk workflows.

## Source Map

```text
packages/contract/src/
  protocol/error.ts               public contracts, catalog types/helper
  protocol/http.ts                HTTP envelope schema builder
  protocol/websocket.ts           WS error-message schema builder
  auth/error.ts                   public Auth code/message/details
  backend/auth.error.ts           Identity/Access catalog policy
  backend/request.error.ts        request-rejection catalog policy
  backend/system.error.ts         safe internal-error fallback
  backend/index.ts                separate backend-only export

packages/backend/src/
  platform/error/
    error.factory.ts             common native Error factory + typed identity
    error.mapper.ts              dependency-error reexpression helper
    error.catch.ts               selective typed async recovery
    error.resolver.ts            explicitly composed public catalog lookup
    error.diagnostic.ts          bounded privacy-safe diagnostic projection
    index.ts                     owner-facing factory/helper exports
  platform/request/request.error.ts
  platform/http/error/            inbound normalization, policy, terminal filter
  platform/http/route/            one OpenAPI/runtime route contract
  platform/websocket/ws.error.adapter.ts
  bootstrap/composition/error.provider.ts
  core/{identity,access}/*.error.ts
  core/{identity,access}/*.error.mapper.ts
  infra/{database,iam,kvs,storage}/*.error.ts
  infra/{database,iam,kvs,storage}/*.error.normalize.ts
  infra/http/http.error.ts
```

## Definition Model

Each error definition has three independent sections:

| Section | Contents | Consumer |
| --- | --- | --- |
| `public` | literal code, fixed message, safe details schema | HTTP/WS and clients |
| `protocol` | optional HTTP status/retry delay; optional WS close/retry policy | transport adapter |
| `internal` | optional log level | terminal diagnostics |

`defineErrorCatalog(scope, definitions)` assigns `id = scope.reason` and freezes
declarative values. Reason alone is not globally unique. The resolver rejects
duplicate composed IDs or public codes. Definition imports do not register state.
The composition root supplies the actual catalogs explicitly.

Public contracts are exported from root/auth/protocol. Complete policies are
exported only from `@talos-ark/contracts/backend`; that entry is not secret access
control, but frontend imports must stay on public entries. Neither entry imports
Nest, Pino, Prisma, SDK errors or backend implementation classes.

Infra catalogs remain backend-local technical classifications. They normally
have no public section; escaping without semantic reexpression produces the
safe internal error, not a fabricated business outage.

## Factory and Private Failure

`defineErrorClass(catalog, { name?, diagnosticMessage? })` returns a native Error
constructor. Owners retain `new IdentityError({ reason }, { cause })`, but do not
implement constructors, prototype mechanics, identifiers or public publication.
Public details input is inferred per reason from the shared schema. An owner can
provide an additional private failure type as the second generic parameter.

Instances preserve native cause/stack behavior and carry non-enumerable,
read-only identity/failure/details/retry properties. The factory records genuine
instances in a private WeakMap. Arbitrary objects or native errors with a forged
`reason`/`id` are not resolved as business errors. The failure snapshot is shallow;
owners must not mutate nested payloads after throwing.

`failure` is private diagnostic/business data. Only explicitly supplied `details`
is published, and only after schema validation and JSON checks. Never pass SQL,
credentials, SDK response bodies or arbitrary failure spreads as public details.
Outbound HTTP retains its adapter-only response in `failure.response`, not details.

The optional diagnostic message callback is backend-local, not a public message
formatter. The default safe diagnostic serializer omits arbitrary messages.
Retry options are hints to a transport, not permission to replay a command.

## Semantic Mapping and Recovery

`defineErrorMapper(SourceError, TargetError, projection)` creates a function
`(error: unknown, ...operationContext) => TargetError | undefined`. It recognizes
only the source class, calls an owner-defined typed projection, and automatically
retains the original instance as `cause`. Undefined means unhandled, not success.
Projection/constructor errors propagate; nothing logs or retries here.

This mapper is intentionally different from the removed API/public mappers:
it changes business meaning, rather than looking up code/message/status for an
already-defined reason. Core/module projections stay with their owner. No
mechanical 1:1 wrapper is needed simply because an error crosses a layer.

Current projections preserve prior business decisions:

- Identity translates expected IAM classifications and KVS/DB outages. Only
  recognized User email/username and ExternalIdentity issuer/subject constraints
  become conflicts; other database errors propagate.
- Access translates DB outages into session-unavailable and an expected missing
  session into session-inactive only when the operation requests that meaning.
- SDK normalizers retain availability/configuration/not-found/constraint
  distinctions; they never decide a public Auth outcome.

`catchError(operation, SourceError, handlers)` recovers only explicitly selected
reasons with narrowed error types. Operation sync throws and Promise rejections
are supported. Unmatched/unknown errors rethrow unchanged, and errors thrown by
the handler are not captured by the same recovery scope. It does not claim that
TypeScript tracks every possible exception a dependency can throw.

For Prisma batch transactions, construct lazy PrismaPromises first and wrap
`$transaction` itself; error handling must not eagerly execute individual members.
No XState or universal Result hierarchy is introduced.

## Resolution and Transport

The resolver uses the outer error's registered identity. It does not traverse
causes or call business projections. Missing catalog/public definition, invalid
details, non-JSON data and non-Error throws fall back to `SYS_INTERNAL_ERROR`
with null details. Original and resolutionError are private diagnostics only.

HTTP defaults to 500 when protocol status is absent. ApiRoute accepts shared
definitions directly, derives complete code/message/details envelopes and
deduplicates identical declarations. Unknown/undeclared errors or broken output
produce internal 500; defaults for public/optional/required auth remain intact.
Retry-After uses an instance hint or definition default without replacing an
existing transport header. JSON is checked after serialization. Public context
is projected, never spread from ALS metadata.

WS uses the same public definition without HTTP imports. Its adapter returns
`{ message, error, closeCode? }`; send only message, log error through diagnostics,
and apply closeCode only at the actual gateway. Invalid message/context falls
back safely. Optional retryAfterMs is a hint; absent close policy does not close
the socket. There is no actual WS gateway/business operation in this change.

## Logging and Scope

The error engine depends on neither Nest nor Pino. `createErrorDiagnostic`
returns level/message/plain sanitized data; a terminal HTTP/gateway boundary
chooses the logging integration and records the failure once. Retained Pino
serializers also protect adapter/startup error logging. Cause depth/count and
AggregateError children are bounded; raw vendor messages/properties are excluded.

The current nestjs-pino integration remains unchanged in ownership. Replacing
that integration while keeping Pino requires no change to factories, catalogs,
business projections or resolver. This task does not implement a new logger.

Public codes/messages/statuses and successful business workflows are preserved.
Refresh/logout endpoints remain explicitly unimplemented (501). Verification
uses builds, static checks and disposable probes, not new persistent test scripts,
DB synchronization or live Casdoor/Prisma/Valkey/S3 calls.
