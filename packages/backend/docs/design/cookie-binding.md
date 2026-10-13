# Cookie parameter binding

Implemented on 2026-10-13. This is HTTP parameter binding, not authentication,
signed-cookie verification, or a replacement for Fastify's Cookie parser.

## Interface

```ts
interface CookieOptions {
    schema?: z.ZodType;
    onFailure?: 'throw' | 'undefined'; // default: throw
}

Cookie(selector?: string | readonly string[], options?: CookieOptions, ...pipes);
```

| Selector               | Input passed to schema, or returned without schema |
| ---------------------- | -------------------------------------------------- |
| `'token'`              | One string, or `undefined` if absent               |
| `['token', 'locale']`  | A map containing only present, selected Cookies    |
| Omitted or `undefined` | A copy of the complete parsed Cookie map           |

Maps without a schema have no prototype. Selection uses own properties; inherited
`constructor` or `toString` properties are not Cookies. Request maps are never
mutated. An empty Cookie value is present; use a schema for nonempty requirements.
Selectors must be nonempty names or arrays of such names; an empty array selects
an empty map. The binding snapshots options and copies the selector array.

## Validation and failure

Without a schema, every selected name must be present. Strict multi-selection
reports all missing names. No content-format validation is performed.

With a schema, the schema alone decides requiredness, optionality, defaults,
refinements, and transformations. Missing values reach the schema directly;
there is no separate `required` option. Async schemas are supported.

- `onFailure: 'throw'` raises the existing `RequestError.validation`. Schema issue
  messages use the existing sanitizer, not potentially sensitive refinement text.
  Single-selection issue paths are prefixed with the selected Cookie name.
- `onFailure: 'undefined'` returns `undefined` for the entire parameter, not a
  partially successful multi-selection result.
- Invalid decorator configuration, an uninitialized Cookie parser, and exceptions
  thrown inside schema callbacks are programming/runtime failures, not softened
  input-validation failures.

```ts
const cookieSchema = z.object({
    token: z.string().min(1),
    locale: z.string().optional(),
});
type SelectedCookies = z.output<typeof cookieSchema>;

// Required scalar, preserving the default strict behavior.
@Cookie('token') token: string

// Missing scalar may receive a schema default.
@Cookie('locale', { schema: z.string().default('en') }) locale: string

// Multi-selection: token is required, locale is optional; failure is whole-value.
@Cookie(['token', 'locale'], {
    schema: cookieSchema,
    onFailure: 'undefined',
}) cookies: SelectedCookies | undefined

// Validate the complete parsed map.
@Cookie(undefined, { schema: cookieSchema }) cookies: SelectedCookies
```

Use type aliases such as `z.output<typeof schema>`, not Zod DTO classes, for these
parameters. The existing global `ZodValidationPipe` can independently validate
class-typed parameters again, including custom decorators. Additional Nest pipes
are explicitly forwarded after `options`; their errors are outside `onFailure`.
Neither global pipe configuration nor ApiRoute contracts change.

The former schema/DTO-as-selector forms are removed: replace `@Cookie(schema)` or
`@Cookie(Dto)` with `@Cookie(undefined, { schema })` and an output type alias.
The only current production caller is the OIDC callback, which explicitly retains
`onFailure: 'throw'`; its missing-Cookie response and authentication behavior stay
unchanged.

## Verification

No maintained test files were added, following the current iteration policy.
One-off checks ran against compiled source:

- 40 extraction assertions: scalar/multi/full selection, strict/soft failure,
  empty values, own-property handling, map isolation, optional/default/transform/
  async schemas, sanitized issues, and programming-error propagation.
- 18 Nest/Fastify HTTP cases: actual Cookie parsing and parameter binding, global
  pipe interaction, extra pipe instances/classes, existing HTTP error resolution,
  and the compiled AuthController OIDC callback with a stubbed AuthService.
- In-memory TypeScript compilation: seven accepted public call forms and five
  rejected obsolete/invalid forms.
- Backend build, focused ESLint, formatting and diff-whitespace checks.

These are isolated transport checks, not a full application startup or real
OIDC-provider/database integration.
