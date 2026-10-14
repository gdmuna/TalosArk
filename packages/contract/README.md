# TalosArk Contracts

`@talos-ark/contracts` is the framework-independent source of truth for public
wire schemas and their inferred TypeScript types. The directory name remains
`packages/contract`; imports use the package name and its exported subpaths.

## Layout

```text
src/
  auth/
    oidc.http.ts     OIDC request bodies and unwrapped responses
    session.ts       Public session/access-token projection; no refresh token
    session.http.ts  Optional empty refresh/logout body; logout uses HTTP 204
    password.ts      Transport-neutral local-password input bounds/schema
    password.http.ts Provisioning inputs, login, activation and first password
    recovery.http.ts Recovery request/confirmation, accepted/completed projections
    account.http.ts  Authenticated current-account projection
    error.ts         Auth public code/message/details schemas
    index.ts
  protocol/
    scalar.ts        UUIDs and UTC ISO timestamps
    context.ts       Allowlisted public response context
    error.ts         Shared error content and request rejection definitions
    http.ts          HTTP success/error envelopes
    websocket.ts     WebSocket error message and optional correlation ID
    index.ts
  team/
    team.http.ts    Organization/workspace creation, accessible context and projections
    error.ts        Public team access rejection
    index.ts
  backend/          Backend-only error catalogs: public + optional protocol + internal policy
    auth.error.ts
    request.error.ts
    system.error.ts
    team.error.ts
    index.ts
  index.ts
```

Each schema and its inferred type live together. Add new protocol files beside
their owning domain, for example `workspace/workspace.ws.ts` when an actual
WebSocket protocol exists. Do not create placeholder domains or messages.

This package does not own Prisma models, Core capability contracts, Nest DTO
classes, IAM SDK types, configuration, signing keys, or business rules. Keep
those in the backend. Access tokens remain opaque to clients; do not turn the
internal JWT claims into a client contract unless a client genuinely needs them.
Pagination and user projections should be added when their HTTP interfaces are
implemented, rather than exporting the current internal Prisma-backed types.

`@talos-ark/contracts/team` describes P04's organization/workspace HTTP boundary.
The accessible snapshot does not contain a server-side active workspace or grant
database entities. `canCreateWorkspace` is a current UI capability projection,
not an authorization credential; every actual request rechecks membership and
grants. Creation bodies reject undeclared actor fields, and path UUIDs normalize
case before application comparisons. P05/P06 invitation and role contracts are
not introduced by this entry.

`@talos-ark/contracts/auth/password` exports only the shared local-password input
schema and code-point bounds. Core and HTTP reuse it without importing each other's
transport types. The backend still owns password admissibility rules, hashing,
capacity, credentials and configuration; none is part of this public entry.

## Usage

```ts
import {
    OidcLoginCallbackBodySchema,
    OidcStartResponseSchema,
    type OidcLoginCallbackBody,
} from '@talos-ark/contracts/auth';
import { createApiResponseSchema } from '@talos-ark/contracts/protocol';

const body: OidcLoginCallbackBody = OidcLoginCallbackBodySchema.parse(input);
const startResponseSchema = createApiResponseSchema(OidcStartResponseSchema);
```

Consumers declare `"@talos-ark/contracts": "workspace:*"`. `exports` resolves
runtime imports to ESM JavaScript and type imports to declarations under `dist`.
Consumers do not import `dist` paths directly or alias the shared TypeScript
source in their own `tsconfig`.

The only runtime dependency is Zod, using the same major/version range as both
applications. TypeScript is a build-time dependency. No framework or JWT/date
library is required here.

## Transport Rules

- HTTP/WS timestamps are UTC ISO 8601 strings ending in `Z`. Convert backend
  `Date` values with `toISOString()` before response validation. No implicit
  date coercion is performed by the shared schemas.
- OIDC callback `code` and `state` are required nonempty strings. Unexpected
  body fields are rejected. The transaction cookie is not part of this body.
- Responses use allowlisted object schemas: parsing removes undeclared fields,
  including nested fields. Controllers explicitly project Core results rather
  than spreading persistence models into HTTP responses.
- Endpoint response schemas describe unwrapped `data`. The backend response
  interceptor wraps them once; frontend endpoint adapters receive unwrapped
  data from the shared API client.
- Browser Auth mutations require a configured allowed Origin and
  `X-TalosArk-Client: browser`. Login/OIDC/refresh deliver RT only through an
  HttpOnly Cookie, never JSON. Refresh/logout reject body RTs and session IDs;
  their optional strict empty body allows no body or `{}`. Logout uses the
  cookie session without requiring a usable AT and succeeds without content.
- Password recovery request uses a uniform 202 accepted projection without
  disclosing eligibility or delivery. Confirm returns a 200 completed projection,
  not session credentials. Reset secrets belong only in the confirm body; they
  are never returned by an HTTP response. The backend still owns expiry,
  one-time consumption, mail behavior and session revocation.
- `ApiResponse` is discriminated by `success`. Error responses have `code`,
  `message`, `type`, and `details`, not a success `data` member. Error details
  remain endpoint-specific instead of forcing a global business-error taxonomy.
- Public error contracts pair a literal `code`, fixed `message` and details schema. HTTP and WS
  schema builders consume the same definition. HTTP adds its documentation URL
  and response envelope; WS adds `kind: 'error'` and optional `correlationId`.
  Details are JSON-safe and validated before publication. Causes, SDK error
  objects, stack traces, headers and arbitrary metadata are never public details.
- The public response context only contains `requestId`, `time`, and optional
  `version` / `userId`. Internal ALS metadata is never included in either success
  or error envelopes. The backend projects public fields explicitly instead of
  spreading the execution context.
- Schema validation establishes payload shape, not authorization, JWT signature
  validity, replay protection, or business success. An OIDC `block` result can
  still be inside a successful HTTP envelope.

## Backend Binding

`@talos-ark/contracts/backend` is an explicit backend-only entry. It exports
declarative error catalogs with `public`, optional `protocol.http` /
`protocol.ws`, and optional `internal.logLevel`. Public root/auth/protocol entries
never re-export these catalogs; frontend code must not import the backend entry.
The definitions contain no logger callbacks, SDK errors or runtime business code.
HTTP defaults to status 500, logging to error level, and WS leaves the connection
open when no close policy is declared. Retry hints are optional, not automatic retries.

Declare request and response schemas once with the backend's `ApiRoute` method
decorator. No backend DTO wrapper class or duplicate HTTP contract is required:

```ts
@Post('oidc/login-callback')
@ApiRoute({
    auth: 'public',
    summary: 'Complete OIDC login',
    request: { body: OidcLoginCallbackBodySchema },
    responses: [{ status: 201, schema: OidcLoginCallbackResponseSchema }],
    errors: [/* shared business ErrorDefinition values */],
})
async callback(@Body() body: OidcLoginCallbackBody) {
    // Return the endpoint's unwrapped payload.
}
```

`request.body`, `request.query`, `request.params` and `request.headers` supply both OpenAPI input
documentation and validation before Nest extracts parameter values. Inferred
aliases may reflect as `Object`; this does not affect route-level validation.
Header projection preserves undeclared transport headers. Optional `security`
overrides only OpenAPI requirements (for example an RT Cookie); actual execution
still follows the declared `auth` guard and owner-local credential checks.

`responses` supports multiple statuses and schemas. Its first entry sets the
default HTTP status; `@Res({ passthrough: true })` may select another declared
status. The backend constructs and validates the complete success envelope,
including `data`, against the actual status's compiled schema. Error bindings
produce complete error-envelope alternatives, including literal code/message
and safe details, used for both documentation and runtime validation.

No additional `ApiBody`, `ZodSerializerDto` or `HttpCode` decorator is needed.
Use only schemas that can be converted to OpenAPI 3.0. Response data must be
JSON-safe. Invalid or undeclared responses become a safe internal `500` rather
than leaking controller output. See `packages/backend/docs/design/api-route.md`
for authentication defaults, empty responses and transport limitations.

## Build and Development

From the repository root:

```sh
pnpm install
pnpm --filter @talos-ark/contracts build
pnpm --filter @talos-ark/contracts type-check
```

Application build/start scripts build contracts before consuming them. Docker
copies the shared package and deploy includes its built production dependency.
Generated `dist` files are ignored; the root workspace lockfile is authoritative.

While editing shared schemas, keep this watcher running in a separate terminal:

```sh
pnpm --filter @talos-ark/contracts dev
```

Then start the backend/frontend with their existing development commands. Node
watch mode observes imported compiled contract modules; Vite follows the linked
ESM workspace package. Restart a consumer after changing package exports or
dependency declarations. Production Node uses compiled JavaScript, not `.ts`
files from the shared package.
