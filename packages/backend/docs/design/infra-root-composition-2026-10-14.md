# Shared Infra Root Composition

## Decision

StorageModule, IamModule and MailModule use one registration interface:
`forRootAsync`. Each activated module exports its declared application-wide
providers; business modules inject their class tokens without registering the
module again. The synchronous `forRoot` interfaces have been removed.

This is one instance per Nest application context, not per operating-system
process. `forRootAsync` and `global: true` alone do not prevent duplicate
registrations. Each composition root is responsible for registering a module
exactly once; there is no process-static cache or named-instance registry.

## Ownership

- `bootstrap/composition/infra.composition.ts` maps typed application configuration
  to adapter options. It contains no business behavior and performs no connection.
- `AppModule` registers IAM, Mail and Storage once. Mail retains its existing
  startup SMTP verification. Constructing the S3 client does not check storage
  availability or create buckets.
- `AccountProvisionModule` registers IAM once and does not activate Mail or
  Storage. Provisioning remains independent of SMTP initialization.
- `IdentityModule` and `AuthRecoveryModule` no longer configure their upstreams.
  Their existing provider injections consume the default shared instances.
- Infra still owns construction, option validation where already present, errors
  and resource teardown. It does not read the application's ConfigService.

Only CasdoorOidcClient, MailService and StorageService are globally exported by
these registrations. SDK clients, transport helpers and options tokens remain
module-private. Bare module imports do not provide a configured instance.

Applications that independently assemble Identity or recovery must activate the
necessary Infra at their own composition root. No compatibility registration is
hidden inside a business module.

## Future Casdoor Authorization

Casdoor exposes remote Casbin enforcement through its own authenticated APIs.
Because this project intends to use that provider, its future authorization
adapter belongs under `infra/iam/casdoor`, alongside but separate from the OIDC
client. IamModule will register the authorization client using the same provider
configuration; Permission consumes that client rather than the OIDC client.

Permission owns subject/resource/action interpretation, workspace scope and
business decisions. Infra owns Casdoor protocol, credentials, response validation
and recognized upstream failures. Sharing a module does not require combining
authentication and authorization methods into one client or one HTTP queue.

An independently hosted authorization provider or an embedded Casbin engine would
justify a separate Infra module. Neither is introduced speculatively here, and no
permission runtime is activated by this change.

Protocol reference: [Casdoor exposed Casbin APIs](https://casdoor.ai/docs/permission/exposed-casbin-apis/).

## Verification

- Backend/contracts build, scoped ESLint, source formatting and `git diff --check`
  passed.
- A disposable stdin probe passed 38 checks with the installed Nest container and
  actual adapter construction: independent consumers share all three instances,
  each module/configuration is registered once, teardown happens once after
  consumers, and a separate IAM-only context never activates Mail or Storage.
- The probe used generated RSA verification material and synthetic options. SMTP
  verification was stubbed; no SMTP/Casdoor/S3/database requests were made.
- No repository test files, environment changes, database writes or permission
  implementation were introduced. These checks are not a real-provider or complete
  application-startup acceptance test.
