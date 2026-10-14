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

- `platform/error/error.diagnostic.ts`: logger-independent, bounded error
  serialization. Native causes and aggregate branches remain structured in JSON.
- `platform/observability/logger/pretty/`: common header, palette, terminal
  sanitization and linear error presentation. Ordinary object rendering uses the
  public `pino-pretty.prettyFactory` entry.
- Owner-local `*.log.pretty.ts`: pure summary adapters. Their only runtime
  dependency is the small pretty interface; no Nest, SDK or application imports.
- Owner-local `*.error.diagnostic.ts`: explicitly approved error projections,
  executed before records are serialized, not in the worker.
- `bootstrap/composition/logger.provider.ts`: the adapter URLs and error projector
  passed to `PlatformLoggerModule.forRoot`. URLs refer to compiled ESM files.

## Adapter interface

An adapter is `(record: PrettyLog) => string | undefined`. Its default export maps
explicit event IDs to adapters. Returning undefined keeps the original message;
throwing during formatting also falls back to that message. Unknown events retain
generic rendering. Duplicate registered IDs fail worker initialization rather than
silently overriding a template.

Only trusted composition supplies module URLs. A record cannot select or import
a module. URLs cross the worker as plain strings; functions are loaded once in the
worker, since functions cannot be structured-cloned. No automatic discovery or
application-wide event enum is introduced.

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

The KVS projector uses fixed descriptions for recognized reasons and connection
codes, numeric ports in range, validated IP addresses, and recognized network
syscalls. It does not output the configured URL or arbitrary SDK messages. These
fields are private diagnostics only; HTTP response envelopes are unchanged.

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
The worker loads its adapters once, dispatches by map lookup, writes each complete
formatted record asynchronously and honors destination backpressure. Graceful
close waits for the destination to flush before completing. On failure the
destination is destroyed and the original error is propagated instead of being
swallowed by the close hook. Existing process shutdown still owns the overall
deadline.

Timestamps and the entire process metadata block are gray, contexts cyan, level
labels use the existing severity palette, and message text uses the terminal's
default foreground. Color-disabled output contains no renderer-generated ANSI
codes. Incoming text is sanitized before the renderer applies styles.

## Adding a domain adapter

1. Add a stable event ID to the owner's existing structured log call. Do not
   change its level or original message merely to obtain a different template.
2. Add a pure owner-local adapter that validates its required fields and returns
   undefined when they are absent.
3. Register its compiled file URL in the composition root. Import only the
   pretty interface and pure helpers from that adapter.
4. Add an error projection only when additional diagnostics have an explicit
   privacy policy. Never restore arbitrary messages as a formatting shortcut.
