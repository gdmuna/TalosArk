# TalosArk Contracts

`@talos-ark/contracts` is the framework-independent source of truth for public
wire schemas and their inferred TypeScript types. The directory name remains
`packages/contract`; imports use the package name and its exported subpaths.

## Layout

```text
src/
  auth/
    oidc.http.ts     OIDC request bodies and unwrapped responses
    session.ts       Login session credentials in their existing wire shape
    index.ts
  protocol/
    scalar.ts        UUIDs and UTC ISO timestamps
    http.ts          Success/error envelopes and public response context
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
- `ApiResponse` is discriminated by `success`. Error responses have `code`,
  `message`, `type`, and `details`, not a success `data` member. Error details
  remain endpoint-specific instead of forcing a global business-error taxonomy.
- The public response context preserves existing fields, but is defined
  independently of ALS. The backend projects its allowed fields explicitly so
  adding an internal context property cannot automatically expose it.
- Schema validation establishes payload shape, not authorization, JWT signature
  validity, replay protection, or business success. An OIDC `block` result can
  still be inside a successful HTTP envelope.

## Backend Binding

Use the schema directly on the body parameter; no backend DTO wrapper class or
duplicate HTTP contract file is required:

```ts
@Body(new ZodValidationPipe(OidcLoginCallbackBodySchema))
body: OidcLoginCallbackBody
```

Bind a response schema with `@ZodSerializerDto(ResponseSchema)`. The existing
global serializer validates the unwrapped result before the envelope is added.
OpenAPI body/response metadata is derived with
`z.toJSONSchema(schema, { target: 'openapi-3.0' })`; it does not depend on runtime
reflection of an erased TypeScript type alias.

Do not enable a globally strict DTO-declaration pipe with this parameter-level
schema pattern. Nest reflects inferred aliases as `Object`; the explicit
parameter pipe is what supplies the runtime schema.

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
