# Development and Test Seed

Seed fills a development/test database through existing business capabilities.
Definitions describe data, factories generate typed content, groups compose datasets,
and seeders translate logical references into real service calls. The executor does
not contain domain dataset definitions or bypass normal authorization and auditing.

Run from `packages/backend`:

```powershell
pnpm db:seed:build
pnpm db:seed list
pnpm db:seed plan --group business-demo --namespace demo-01
```

`plan` is offline. `list` shows all registered definitions and marks whether they
support independent selection or require group-provided references.

## Fill a Workspace

Prepare the business schema and approved native DDL with the existing database
commands first. Then explicitly opt the intended database into seed:

```powershell
pnpm db:seed init --env dev.local --database talosark_dev --purpose development
pnpm db:seed apply --group business-demo --namespace demo-01 --env dev.local --database talosark_dev --credentials-output ../../output/seed/demo-01.private.json --output ../../output/seed/demo-01.json
pnpm db:seed verify --group business-demo --namespace demo-01 --env dev.local --database talosark_dev
```

Without `--actor`, ordinary groups create an activated local account and a new
organization/workspace. Governance groups create isolated personas and scopes.
No group creates a system administrator. Passwords are random, hashed through
Identity and exported only to the explicitly selected private file.

Account creation requires `--credentials-output`. The file must not already exist;
parent directories are created. POSIX mode is `0600`; Windows directory ACLs remain
the operator's responsibility. Never commit this file. `output/` is ignored. The
private file also contains the local invitation inbox; no invitation email is sent.
On ordinary failure, credentials already created during the run are still exported.
A hard process kill cannot guarantee that final export; plaintext credentials cannot
be recovered from database receipts.

`--output` contains normal references, including real account/organization/workspace/
material/stock IDs, not passwords or tokens. To use an existing account, provide
`--actor <uuid>`. To fill an existing workspace, also provide both `--organization`
and `--workspace`. The actor must already have the relevant grants; seed never
repairs grants or adopts existing rows. Governance and credential regression groups
reject these overrides because they own their personas and scopes.

Database configuration comes only from `ops/prisma/env`, never runtime secret files.
Interactive terminals may choose a profile; CI must select `--env` or `--env-file`.
Connected actions require `--database`. `init` creates/upgrades only `seed.target`,
`seed.run` and `seed.record`, not business tables or extensions.

## Data Groups

| Group | Contents |
| --- | --- |
| `minimal` | Local owner if needed, organization, workspace and real initial roles/memberships |
| `material-demo` | 20 consumable, 15 chemical and 15 biological materials |
| `material-regression` | Unicode, long names, nullable codes, legacy-style codes and archived materials |
| `material-volume` | Parameterized branch/count, default 5000, maximum 10000 |
| `lab-demo` | 15 chemicals, a cabinet, 15 positions and 15 real stock receipts |
| `governance-demo` | 12 accounts, two organizations, four workspaces, profiles, roles, members and invitations |
| `authorization-regression` | Governance with explicit positive/negative access assertions |
| `business-demo` | Governance, all material branches, isolated materials, batches, facilities, inventory history and approvals |
| `governance-volume` | `count` actual members, default 50, maximum 199, plus an owner |
| `inventory-volume` | `count` actual stock items, default/maximum 100, each with an exclusive position |
| `credential-regression` | Activation, real password verification, revoked/consumed recovery credentials |
| `attachment-integration` | Opt-in actual single/multipart uploads, binding, download/hash verification and unbinding |

Governance covers organization-only/basic members, departure/rejoin, workspace-only
departure, multi-workspace/organization users, multiple bindings, organization/workspace
custom roles, an archived role and pending/revoked/resent/accepted invitations.
Access assertions fail on the wrong decision rather than recording whatever happened.

Business demo includes UNKNOWN/NONE/DATED/archived batches and optional batch receipts;
explicit unknown/non-expiring/future/expired instance dates; partial/full consumption,
zero adjustment, disposal and transfer. Facilities include disabled/archived cases,
USE/MANAGE grants, a 2x3 grid, node states, empty subtree movement and ordering.
Approvals include CONSUME/TRANSFER, pending/withdrawn requests, approval/rejection/mixed
decisions, pending execution, execution, abandonment and revocation. Resources, audits,
transaction lines, events and idempotency facts arise from these real operations.
The database/module owns ltree paths; seed never constructs them itself.

For parameters, use a JSON file such as `{"count":100,"branch":"chemical"}`:

```powershell
pnpm db:seed plan --group material-volume --namespace volume-01 --params-file ./volume.json
```

Independent material definitions support `--dataset chemical-demo` or an intersection
such as `--tag material demo`. Dependent definitions are visible in `list` but must be
composed through groups. Tags classify datasets; they do not infer dependencies.

## Attachment Integration

Only this group accepts `--storage-config <private-json-path>`. JSON keys reuse the
existing storage schema: `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and
optionally `S3_REGION`, `S3_BUCKET_PRIVATE`, `S3_BUCKET_STAGING`, `S3_FORCE_PATH_STYLE`,
`S3_PUBLIC_BASE_URL`. Secrets are not plan parameters or report content. Do not use
production storage. Buckets must already exist; seed does not provision them or CORS.

```powershell
pnpm db:seed apply --group attachment-integration --namespace attachment-01 --env dev.local --database talosark_dev --storage-config ../../output/seed/storage.private.json --credentials-output ../../output/seed/attachment-01.private.json
pnpm db:seed verify --group attachment-integration --namespace attachment-01 --env dev.local --database talosark_dev --storage-config ../../output/seed/storage.private.json
```

The fixture uploads TXT and a CSV large enough for two default 8-MiB multipart
parts, checks authorized download size/SHA-256 and removes a third binding. File
metadata is created by the actual workflow. SVG is not included. Ordinary groups
do not initialize S3.

Remote workflows use `transaction: 'business-managed'`: File owns its short database
transactions; no outer transaction spans network I/O. File publication and the seed
receipt are **not atomic**. A crash may leave an upload/asset without a seed receipt.
Investigate retained sessions and use normal file cleanup; there is no automatic
replay or pretend rollback. Verify checks persisted final facts, not every remote
object's current bytes. Upload completion and the initial download check actual bytes.

## Define a Dataset

Pin the schema kind before defining data. Return raw, statically checked input;
parsing is a runtime boundary, not a way to conceal an untyped object:

```ts
import { z } from 'zod';
import { defineDatasetFor } from '../../seed.definition.js';
import { materialKind, type MaterialSeedInput } from '../../seeder/seed.kind.js';

export const ethanol = defineDatasetFor(materialKind)({
    id: 'ethanol', version: 1, tags: ['material', 'chemical', 'legal'],
    description: 'One ethanol material', parameters: z.strictObject({}),
    build: (): MaterialSeedInput => ({
        types: [{ key: 'reagent', input: { code: 'REAGENT', name: 'Reagent' } }],
        materials: [{ key: 'ethanol', typeKey: 'reagent', input: {
            code: 'ETOH', name: 'Ethanol', branch: 'chemical', quantityUnit: 'mL',
            attributes: { molecularFormula: 'C2H6O', physicalForm: 'Liquid' },
        } }],
    }),
});
```

Use `z.input` for authored/defaultable input and `z.output` for normalized seeder
data. Business schemas derive from shared contracts; kernel-only conversions use
kernel input types. Material branches preserve discriminated unions. Factories
return concrete input types; business request literals use `satisfies` before parse.
Group parameters, references, record outputs and registrations are pinned using
`NoInfer`. Only the explicit CLI boundary accepts unknown parameters. Do not bypass
the chain by casting to `any`, `unknown` or normalized output.

Groups declare dependencies in order and pass typed outputs:

```ts
const { scope, steps } = baselineSteps(context);
const material = datasetStep('material', ethanol, {}, context.generation,
    results => results.get(scope));
return { parameters: {}, steps: [...steps, material] };
```

Register a domain's data/input/output schemas, `BusinessSeeder<typeof kind>` and one
composition-root binding. Keep definitions out of the executor. Each bounded write
uses `execution.record({key, output, create, inspect})`; inspect reads stable persisted
facts, excluding derived values such as today's expiry risk. Later operations may
legitimately mutate earlier rows. Once all steps finish, final snapshots are recorded;
subsequent verification compares final state, not stale creation state. Increase
dataset/group versions when content or semantics change.

## Safety and Verification

A namespace belongs to one exact engine/group/dataset version, generated content,
parameters, seed/reference date, actor and scope. Changed/deleted facts reject;
there is no silent repair. `--seed` defaults to 42, `--reference-date` to `2026-01-01`.
They never replace real IDs, credential randomness, operational times or business
clock. Explicit fixture dates are not a simulated clock.

Completed apply becomes read-only verification. Prefer `verify --output <new-path>`
to export old references without producing an empty private credential file.
Failed/interrupted runs retain commits and cannot resume automatically. Verify can
diagnose a retained prefix, but missing receipts/changed intermediate state reject.
There is no generic reset/delete/rollback command. Engine version 2 and final
snapshots do not adopt old plans: rerun init for metadata, then choose a new namespace.

The marker pins database name/OID/role and dev/test purpose. A session advisory lock
excludes concurrent seed commands. Production profiles and `NODE_ENV=production`
reject. Operator opt-in does not prove the absence of production data. A namespace
prevents identifier collisions, not tenant or concurrent-user isolation.

`pnpm seed:typecheck` checks the separate seed graph and compiler-rejection probes.
CI runs it after contract build/Prisma generation without DB access. Runtime Zod,
authorization and database rules still own semantic constraints.

Locally verified using disposable PostgreSQL/RustFS: full business apply/verify,
actual single/multipart upload/download/unbind and verify, credential recovery
apply/verify and small governance/inventory volume fills. This is not browser,
HTTP-session, external OIDC, SMTP or production acceptance.
See [coverage.md](coverage.md) for unavailable capabilities.
