# Logger diagnostics and pretty adapters

## Scope

Pino and nestjs-pino remain the logger and Nest integration. Development writes
pretty console output through one asynchronous worker; other environments retain
the existing asynchronous JSON file destination. This change does not introduce
new output modes, sampling, remote sinks, severity policies, or retry behavior.

The same Pino root serves request children and out-of-context logs. Log messages
and pretty summaries use English unless Chinese is explicitly requested. Existing
business fields, slow thresholds and levels are preserved. Emitters add
a stable `event` discriminator; only the console summary is replaced. In
particular, outbound HTTP `attempts` remains in the object and never enters its
summary, including when greater than one.

## Ownership

- `platform/error/error.diagnostic.ts`: bounded error-tree serialization, also used
  by the pre-container fatal-error path. Native causes and aggregate branches remain
  structured in JSON; logger projection contracts are type-only dependencies.
- `platform/observability/logger/logger.diagnostic.ts`: SDK-free, JSON-like owner
  projection contracts, without domain-specific address/port/operation fields.
- `platform/observability/logger/pretty/`: common header, palette, terminal
  sanitization and linear error presentation. Ordinary object rendering uses the
  public `pino-pretty.prettyFactory` entry.
- Owner-local `*.log.pretty.ts`: pure summary adapters. Their only runtime
  dependency is the small pretty interface; no Nest, SDK or application imports.
- Owner-local `*.log.diagnostic.ts`: explicitly approved error projections,
  executed before records are serialized, not in the worker.
- Owner-local `*.log.contribution.ts`: native diagnostic/pretty namespace imports,
  declared through `@LoggerExtension` on the owner's existing Module. The performance
  interceptor declares its own contribution; it has no dedicated HTTP Module.
- `logger.registry.ts`: discovers static declarations, snapshots callbacks/URLs and
  checks unique contribution IDs. It does not instantiate contribution Providers.

## Adapter interface

An adapter is `(record: PrettyLog) => string | undefined`. Its default export maps
explicit event IDs to adapters. Returning undefined keeps the original message;
throwing during formatting also falls back to that message. Unknown events retain
generic rendering. Duplicate registered IDs fail worker initialization rather than
silently overriding a template.

Only trusted registered classes supply module references. Each pretty module
exports `moduleUrl = import.meta.url`; the main thread consumes the namespace via
ordinary imports and transfers only its URL, contribution ID and source. A record
cannot select or import a module. Functions are imported once in the worker, since
functions cannot be structured-cloned. No application-wide event enum is introduced.

The adapter cannot request field removal. Fields remain in their existing object
layout even when duplicated in the summary. Common header fields and the new
`event` discriminator are omitted from the display copy, not from JSON.

## Current events

| Owner                    | Events                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| DatabaseClient           | `database.connected`, `database.disconnected`, `database.query.completed`, `database.query.slow`, `database.query.critical` |
| KVS                      | `kvs.connected`, `kvs.closed`, `kvs.close.timeout`, `kvs.connection.error`                                                  |
| Inbound HTTP performance | `http.request.completed`, `http.request.failed`, `http.request.slow`, `http.request.critical`                               |
| Outbound HTTP            | `http.outbound.completed`                                                                                                   |

Example summaries (values are illustrative):

```text
WARN ... [DatabaseClient] Slow query · 132ms
DEBUG ... [PerformanceInterceptor] GET /api/materials → 200 · 24ms
DEBUG ... [HttpClientFactory] casdoor · fetch-user → 200 · 86ms
ERROR ... [KvsClient] Valkey connection refused
```

Existing object fields follow these lines without adapter-specific filtering.
Prisma templates do not invent a model, operation or SQL absent from its events.
Outbound templates do not infer HTTP methods or URLs from operation identifiers.

## Error privacy and presentation

The serializer never copies arbitrary vendor messages, URL credentials, response
objects, SQL or parameters. Known factory errors receive their WeakMap-verified
identity and constructor-approved description, rather than a generic
`Operation failed: ...` message. An optional owner projector may provide a
bounded, explicitly approved description and technical coordinates. Projection
failure does not prevent the base error diagnostic from being recorded.

The KVS projector uses fixed descriptions for recognized vendor connection codes,
numeric ports in range, validated IP addresses, and recognized network
syscalls. It does not output the configured URL or arbitrary SDK messages. These
fields are private diagnostics only; HTTP response envelopes are unchanged.
Domain errors already supply constructor-approved messages; Mail/KVS projections
do not repeat those messages. Mail additionally projects phase/outcome. HTTP,
Storage and IAM project their former operation/status fields in their own modules.

Extra fields stay flat. Only plain JSON data is copied; accessors, SDK objects,
non-finite numbers and prototype/toJSON keys are excluded. Error/Pino structure is
reserved (`type`, `id`, `code`, `reason`, `stack`, `cause`, `errors`, omission markers,
`validationIssues`, `name`, `pid`, `hostname`, `time`, `level`, `msg`, `context`, `event`).
`message` is the explicit override exception. Keys are bounded ASCII labels. Each
projection has at most 32 fields, nested objects 32 keys, arrays 16 entries and four
object levels. Across one error tree there is a budget of 128 fields/elements and
8,192 projected string characters; individual strings are capped at 512 (messages
400). These limits are data-safety checks, not a contribution schema framework.

Cause depth is bounded to eight, total visited errors to 32, stack frames per
error to 30 and aggregate children to four. Omitted frames/children have explicit
counts. Circular causes and other limits retain marker diagnostics.

Linear diagnostics under `err`, `error` or `resolutionError` render their heading,
safe metadata and stack without an enclosing object. Every cause retains its own
heading and frames. If any cause branches, the entire diagnostic keeps its object
layout so stack ownership is unambiguous. Multiple diagnostic fields keep labels
to distinguish the original failure from a resolution failure.

The original error objects and serialized records are not modified by rendering.
JSON always keeps the bounded error tree; pretty only changes its presentation.

## Configuration validation diagnostics

`platform/error/error.validation.ts` projects Zod failures into bounded, immutable
diagnostics containing field, code, expected constraint, received description and
an optional owner-defined correction hint. It does not retain the Zod error or
its rejected input. `config/internal/config.validation.ts` applies this to all runtime
environment groups; Mail and IAM also apply it to explicit module options.

Numeric/boolean values are shown only for approved scalar settings. Credentials,
keys, certificates, URLs and mail content retain type/missing information, not
their values. Sensitive strings do not expose their lengths. Arbitrary custom
refinement messages and unknown property names are not copied; owners explicitly
provide approved constraint descriptions. At most 20 issues plus an omission
marker are kept, and projected text is bounded and stripped of control bytes.

Errors contain a readable multiline message for Nest's early startup logger,
which runs before the application's Pino logger is bound. JSON diagnostics retain
the same constraints in a separate `validationIssues` array; linear pretty output
renders them as indented lines before the stack. Aggregate branches retain their
structured representation. Pino's automatic copy of our multiline Error.message
is recognized for display only, avoiding duplicate rows without modifying the
record or replacing a caller's distinct business message.

Example of the previously opaque SMTP constraint:

```text
MailError [mail.configuration]: Invalid SMTP configuration
  - requireTLS (SMTP_REQUIRE_TLS) [custom]
    expected: SMTP_SECURE=true or SMTP_REQUIRE_TLS=true when SMTP_USER is configured
    received: false
    hint: Enable STARTTLS with SMTP_REQUIRE_TLS=true, or use implicit TLS. Authentication over plaintext is not allowed.
```

Validation acceptance, defaults, retries, severity and public HTTP error contracts
are unchanged. Known DB, transaction, KVS, HTTP, storage and IAM failures now have
owner-defined English descriptions; unknown vendor messages remain excluded.
Isolated verification exercised startup/ConsoleLogger, real Pino calls and pretty
rendering, all 12 environment groups, cross-field checks, sensitive-value
exclusion and message/record immutability. No real provider calls or mail delivery
were used, and no maintained test script was added.

## Runtime

`pino-abstract-transport` parses the Pino stream using its standard implementation.
The Nest logger factory waits for the pretty transport's `ready` event before
publishing the logger. A five-second deadline, missing required module or duplicate
event fails startup before listen/readiness. Failure cleanup waits for stream close
as well as native worker exit, retaining an error listener for delayed notifications.
Declarations are collected after Nest scans modules but before provider initialization;
instance/method contributions use the separate post-module-init discovery path.
The worker loads its adapters once, dispatches by map lookup, writes each complete
formatted record asynchronously and honors destination backpressure. Graceful
close waits for the destination to flush before completing. On failure the
destination is destroyed and the original error is propagated instead of being
swallowed by the close hook. Existing process shutdown still owns the overall
deadline.

Current tsc/NodeNext output preserves individual ESM modules and Docker copies all
of dist. Startup gates validate enabled worker imports/initialization, not every
future event callback or a future bundler's output. No build generator, separate
deployment probe, worker recovery or external alert integration is introduced.
See [implementation record](logger-contribution-2026-10-15.md) for boundaries and evidence.

Timestamps and the entire process metadata block are gray, contexts cyan, level
labels use the existing severity palette, and message text uses the terminal's
default foreground. Color-disabled output contains no renderer-generated ANSI
codes. Incoming text is sanitized before the renderer applies styles.

## Adding a domain adapter

1. Add a stable event ID to the owner's existing structured log call. Do not
   change its level or original message merely to obtain a different template.
2. Add a pure owner-local adapter that validates its required fields and returns
   undefined when they are absent.
3. Export `moduleUrl = import.meta.url`; use a native namespace import in the
   owner's `*.log.contribution.ts` and declare it on its existing Module with
   `@LoggerExtension`. Do not add an empty Provider or a Bootstrap registry entry.
4. Add an error projection only when additional diagnostics have an explicit
   privacy policy. Never restore arbitrary messages as a formatting shortcut.
