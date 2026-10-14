# W07: IAM, Identity and Access contracts

## Scope

W07 closes the previously exposed supplier SDK, raw claims and arbitrary Prisma
nested-write interfaces. It preserves explicit account creation, external binding,
session creation/rotation/revocation and session listing capabilities. This is a
breaking internal TypeScript/DI change without compatibility facades. Public HTTP
schemas and routes are unchanged.

Casdoor remains required. Endpoint, client ID/secret, organization, certificate and
OIDC redirect URI remain mandatory. Application and explicit issuer retain their
existing optionality; issuer still defaults to the normalized endpoint. No disabled
IAM startup mode, provider registry or second provider has been introduced.

## IAM ownership and composition

- `IamModule.forRootAsync` requires explicit `CasdoorIamOptions`. Composition
  owns reading application configuration; adapters do not inject ConfigService or
  read environment variables. Web and provisioning roots each register the shared
  dependency once; IdentityModule no longer registers IAM itself. The 2026-10-14
  composition update is recorded in [shared Infra composition](infra-root-composition-2026-10-14.md).
- The module exports only `CasdoorOidcClient`. It replaces the property-only
  IamClient aggregate and separate public token/SDK adapters.
- The client exposes authorization URL generation and authorization-code resolution
  to a verified external identity. Exchange response bodies, supplier credentials
  and verified raw claims stay inside IAM.
- Options are parsed, copied and frozen even for direct client construction. The
  RSA public key is parsed once at construction. Invalid key material or incomplete
  options fail before creating an outbound HTTP resource.
- Token verification is an internal implementation. AT verification and ID Token
  nonce verification are distinct operations; their existing issuer, audience,
  algorithm and time checks remain in place. No new cryptographic library is used.
- The existing SDK convenience methods remain in the internal CasdoorClient:
  supplier refresh/introspection, legacy exchange and supplier URL generation.
  Neither this class nor a raw SDK/token is a module/public-entry export. Normal
  login does not instantiate the unused SDK helper. A future approved use must
  expose a deliberate contract, not resurrect unrestricted SDK access.
- HttpClientFactory retains HTTP resource ownership and cleanup. PKCE exchange
  keeps its 10-second deadline and disables retry, singleflight and replay. Native
  cancellation can be supplied to the client and remains cancellation, not an IAM
  availability error. Unknown errors preserve identity; recognized errors retain
  the existing owner-local mapping model.
- Public results whitelist only issuer, subject and current registration profile
  fields. Malformed extra profile fields are omitted, not asserted as SDK types.
  Parser failures do not retain JSON error messages that could contain credentials.

## Breaking internal interfaces

| Previous interface                                  | Replacement                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| IamClient plus SDK/OIDC/token properties            | Explicit CasdoorOidcClient dependency                               |
| Static IamModule with implicit global configuration | Explicit forRootAsync options in composition                        |
| VerifiedIamToken and raw claims                     | VerifiedExternalIdentity with an owned profile                      |
| Identity callback returning supplier token set      | External identity reference and registration fields                 |
| Lookup by a complete provider token                 | Lookup by issuer/subject; this is not authentication evidence       |
| Prisma UserCreateInput excluding sessions           | Owned username/email/hash, profile and external identity references |
| Prisma ExternalIdentityCreateInput                  | Explicit userId/issuer/subject binding                              |
| Full User/UserProfile/ExternalIdentity models       | Capability-owned snapshots and explicit query selects               |
| SessionModel list items                             | SessionSnapshot and explicit query selects                          |
| Public GenerateTokenPair input/output               | Private implementation signature and inferred result                |

Account creation no longer accepts caller-selected IDs/timestamps, password-reset
records, organization memberships, stock, task or other unrelated graph writes.
Those domains must use their own capabilities and compose through DatabaseRuntime
if atomicity is required. UserProfile's owned fields and multiple external bindings
remain supported. Password hashes are accepted only as internal account input and
never included in snapshots. This does not implement password authentication.

Explicit data construction also ignores unrelated properties passed by untyped
JavaScript callers. These TypeScript and DI restrictions are not a runtime security
sandbox or authorization policy. Deep imports/casts do not grant authorization.

## Retained application behavior

- Identity owns state, nonce, PKCE generation and one-shot KVS transaction use.
  IAM owns provider verification and field extraction. Auth owns registration
  admission and local-session orchestration.
- Existing bindings still log in without requiring a registration email. A new
  account without a usable string email still returns the existing block result.
  A new account with an email but no string username is now explicitly rejected
  as provider-response-invalid instead of reaching a Prisma input error. No email
  verification requirement, automatic account merge or fallback username is added.
- User/profile/external-identity nested creation remains one atomic ORM write.
- Missing ID Token still falls back to the access token before nonce verification.
  The access token still undergoes its previous verification. This supplier-specific
  behavior is preserved, not advertised as a generic OIDC policy.
- Account creation and first session creation are still separate commits when
  there is no outer database transaction. Session failure can leave an account.
  No encompassing transaction or automatic replay has been introduced.
- Public OIDC, refresh and logout responses keep their existing shape/status/date
  serialization. TalosArk refresh remains distinct from supplier-token refresh.
- W05 RT consumption, generation checks, revocation/expiry and older-AT validity
  rules are unchanged. List pagination and its existing transaction behavior remain.

## Transaction and error contract

Identity and Access use context-aware queryClient and never cache a transaction
delegate or bypass scope through database.client. Atomic nested writes join an
ambient transaction. Without one, each operation retains its existing boundary.
An intermediate result is not proof that the physical transaction committed.
Credentials must not be sent/cached/published as successful before the outer owner
confirms commit.

RT rotation opens or joins a required transaction explicitly declared ReadCommitted.
A parent must declare the same isolation; an unspecified isolation is not guessed
to be compatible. An incompatible parent receives options-conflict before rotation
work. Offset listing joins a required transaction without changing outer isolation.
No requiresNew substitution, automatic retry or savepoint recovery is added.

Recognized managed SQL errors can mark rollback-only before domain mapping. Catching
user-conflict/identity-conflict does not repair that transaction; recovery requires
leaving it and making an explicit new attempt. A failed joined run also poisons its
physical scope. Structural transaction errors remain internal orchestration failures,
not user authentication outcomes. Unknown errors preserve identity; existing finite
domain mappers retain causes and do not traverse cause trees to manufacture results.
IAM/KVS side effects are not rolled back by a database transaction. afterCommit is
best effort and is not a credential-delivery or durable-message mechanism.

## Verification on 2026-10-13

No test scripts were added or maintained. Disposable checks used compiled code,
in-memory keys and a local HTTP server or isolated dependency doubles:

- 61 IAM/protocol/composition checks: actual HttpClientFactory and local exchange,
  PKCE fields, separate ID Token/AT verification, nonce/algorithm/signature failures,
  preserved AT fallback, malformed responses, provider failures, no replay,
  cancellation, safe result/HTTP observation fields, immutable configuration,
  eager key errors, synchronous/asynchronous Nest module factories, private SDK
  provider and HTTP shutdown cleanup.
- 50 Identity/Auth/Access checks: real kernels and Auth/controller with isolated
  database/KVS/provider dependencies, one-shot state, nested creation shape,
  multiple bindings/profile fields, rejected unrelated graph writes, finite
  conflicts, unknown-error identity, existing-account/missing-email branches,
  real ES256 credential signing/verification, session selects and unchanged HTTP
  date serialization. The probe initializes the same UTC plugin as main.ts.
- 10 TypeScript negative-contract checks in a virtual source file: obsolete SDK
  aggregate/token types, raw claims/credentials, arbitrary nested writes, missing
  mandatory module options and private token-generation contracts are rejected.
  Valid owned commands and lookups compile. No probe files were written.
- Contract/backend build, scoped ESLint, formatting and whitespace checks passed.
  One Windows ENOTEMPTY output-directory cleanup failure passed on build retry.

No real Casdoor, development/production database, schema synchronization, migration,
full deployment or database concurrency checks were run in this work package. The
earlier database-runtime/W05 verification is historical evidence, not a rerun.
Internal supplier SDK helpers remain without a new real-provider integration check.
