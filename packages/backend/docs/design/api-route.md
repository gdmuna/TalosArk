# API Route Contract

Status: implemented, updated 2026-10-13. Replaces the old `responseType` / `successStatus`
options and independent body/serializer decorators, without a compatibility layer.

## Design

`ApiRoute` is a cohesive HTTP contract declaration, not a universal decorator for
business behavior. Its implementation is split into compilation, OpenAPI,
request capture, validation and exception handling. Business authorization,
transaction rules and dependency-error reframing remain with their owners.

Each JSON controller handler needs two method decorators: `@Get` / `@Post` etc.
for routing, and `@ApiRoute` for the contract. Parameter decorators still bind
values. Schemas belong to the framework-independent contract package; compiled
error protocol/internal policy is available through the contract package's
backend-only entry. Nest metadata and Swagger decorators stay in Backend Platform.

## Declaration

```ts
@Post('items')
@ApiRoute({
    auth: 'required',
    summary: 'Create an item',
    request: {
        body: CreateItemBodySchema,
        query: CreateItemQuerySchema,
    },
    responses: [
        { status: 201, schema: ItemSchema, description: 'Created' },
        { status: 200, schema: ItemSchema, description: 'Existing item' },
        { status: 202, schema: QueuedItemSchema, description: 'Accepted' },
    ],
    errors: [ItemErrorDefinition.conflict],
})
async create(
    @Body() body: CreateItemBody,
    @Query() query: CreateItemQuery,
    @Res({ passthrough: true }) reply: FastifyReply
) {
    const result = await this.service.create(body, query);
    if (result.existing) reply.code(200);
    return result.item;
}
```

Response `schema` describes unwrapped `data`. Compilation builds the complete
HTTP envelope schema; callers must not wrap the payload themselves. The first
success declaration sets the default status independently of the HTTP method.
The handler must explicitly select any other status with the passthrough reply;
schema matching never guesses a status or rewrites one to make validation pass.

Output is parsed, serialized to its JSON representation, then checked against
the same schema again. The sent value is that checked JSON representation.
Optional undefined object fields are naturally omitted; cycles, BigInt and
serialization changes that violate the declared shape are rejected. This is
not a request to put transforms into output schemas: nonrepresentable Zod
transforms remain unsupported, and refinements should be pure.

Several declarations may share one status. Their complete schemas form a Zod
union, documented as `anyOf` because alternatives need not be mutually exclusive.
Use a discriminated payload union when business outcomes share one status, as
the OIDC callback already does. A union parses the first matching alternative;
prefer disjoint schemas when alternatives project different fields.

`{ status: 204 }` and `{ status: 205 }` have no schema/envelope and require a
null/undefined handler result. `responses: []` is explicitly error-only. A successful result from
such a handler is a contract violation rather than an invented success schema.

## Requests

- `request.body` accepts a Zod schema; body presence follows schema optionality.
- `request.query` / `request.params` accept Zod objects. Properties supply query
  and path parameter documentation; the whole object is validated at runtime.
- `request.headers` accepts a Zod object and documents header properties.
  Parsed fields merge into the original headers; unrelated Authorization,
  Cookie and transport headers are preserved rather than stripped.
- Validation runs before Nest extracts `@Body()`, `@Query('field')` or
  `@Param('field')`. Coercion, defaults, stripping and strict rejection follow
  the declared schema. Input failures produce sanitized, source-prefixed paths.
- Runtime types come from the schema, not reflected TypeScript aliases. Keep
  TypeScript annotations inferred from the same schema.
- `consumes` documents supported request media types (JSON by default); it does
  not install a Fastify parser. Query/path cross-field refinements can be checked
  at runtime but cannot be fully represented by individual OpenAPI parameters.

## Authentication and Errors

Optional `security` overrides OpenAPI security requirements, for example the
refresh-cookie scheme in [P01](mvp-p01-2026-10-13.md). It does not implement
authentication or bypass `auth`, guards, source checks or domain validation.

All routes include the real shared HTTP rejection possibilities: validation /
invalid request `400`, forbidden/CORS `403`, rate limiting `429`, payload too
large `413`, unsupported content `415`, processing timeout `504`, and internal
failure `500`.

A processing-timeout `504` ends the HTTP response wait; it does not prove that the
handler, database transaction, or downstream side effect was canceled or rolled
back. A write with an unconfirmed response must be checked through its business
read/receipt protocol before it is submitted again.

| Authentication | Guard behavior                                                    | Additional default errors                                            | OpenAPI security      |
| -------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------- |
| public         | Does not verify the token                                         | None                                                                 | No bearer requirement |
| optional       | Missing/invalid token is anonymous; valid token supplies identity | `AUTH_SESSION_UNAVAILABLE` / 503                                     | Anonymous or bearer   |
| required       | Missing/invalid token is rejected                                 | `AUTHENTICATION_REQUIRED` / 401 and `AUTH_SESSION_UNAVAILABLE` / 503 | Bearer required       |

Business errors remain explicit. Public login endpoints can declare Auth/Access
errors even though they bypass guard authentication. Permission/resource errors
are not guessed from method names or business service implementation.

An error catalog must be explicitly composed in `error.provider.ts`. A route's
`errors` accepts its shared ErrorDefinition directly; compilation derives status
from `protocol.http.status` (500 when absent) and builds code/message/details
schemas. Before route capture, the HTTP policy uses the same catalog definition,
not a second global status table. Duplicate identical definitions are deduplicated;
conflicting IDs/codes,
invalid statuses and unsupported JSON Schema conversion fail during declaration.

An undeclared mapped error, undeclared success status, malformed output or
non-JSON output becomes the route's default internal `500`. Private causes and
resolution failures remain available to the terminal logger, never the caller.

## Runtime Ownership

```text
ApiRoute
  -> compileRouteContract -> route metadata + status/envelope schema map
  -> routeRequestDocumentation / routeResponseDocumentation -> OpenAPI

RouteContractGuard (first global guard)
  -> capture contract on request before throttle/auth can fail
RouteContractInterceptor
  -> validate/transform declared request sections before parameter extraction
  -> handler result + actual reply status -> full success-envelope validation
HttpErrorFilter
  -> normalize -> resolve -> route/global error binding
  -> full error-envelope validation -> single terminal log -> reply
```

Source is under `platform/http/route`, with the public decorator in
`platform/http/decorators/route.decorator.ts`. `AppModule` owns global execution
order; no import-side-effect registry or decorator-created DI container exists.
OpenAPI is generated directly from the compiled schemas. There is no subsequent
document mutation to add success envelopes and no separate global serializer.

## Limits

This contract covers JSON responses and explicit empty responses. Redirects,
streams, SSE, binary downloads and manually sent replies must use their own
transport implementation, not pretend to satisfy this JSON contract. `ApiRoute`
rejects non-passthrough `@Res()` during declaration. A passthrough reply is only
for selecting a declared status and setting cookies/headers: never call `send`
or write the socket from such a handler. Once headers are sent, no interceptor
can retract an invalid response; the filter logs without sending a second one.

Declared schemas must support Zod's OpenAPI 3.0 conversion. Nonrepresentable
transforms/custom types fail early rather than generating inaccurate docs.
Error details validation remains synchronous, as required by `ErrorResolver`;
request and successful-response parsing supports async refinements. Response
validation does not undo business writes, abort timed-out work, authorize a
request or replace transactional/idempotency guarantees.

Verification uses builds, static checks and disposable Nest/Fastify probes, not
new persistent test scripts, DB synchronization or real external-service calls.

Framework references: [Nest interceptors](https://docs.nestjs.com/interceptors),
[Nest controller response handling](https://docs.nestjs.com/controllers), and
[Zod JSON Schema conversion](https://zod.dev/json-schema).
