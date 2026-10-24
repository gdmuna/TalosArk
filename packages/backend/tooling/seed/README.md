# Development and Test Seed

Seed creates development/test data through existing business capabilities. It does
not insert plausible-looking rows around authorization, audit or inventory rules.

Run from `packages/backend`:

```powershell
pnpm db:seed list
pnpm db:seed plan --group business-demo --namespace demo-v3
```

The launcher incrementally builds the tool before execution. Nest constructor
metadata comes from `tsc`, not tsx. Output lives in `.cache/seed/`, separate from
the application `dist`. `pnpm db:seed:build` explicitly builds the same tool for CI;
its compiled entry is `.cache/seed/tooling/seed/cli/entry.js`. Generated Prisma and
contract types are build prerequisites; building never changes a database.

`list` reads definitions. `plan` validates definitions and reads/hashes referenced
local files, without loading Nest or connecting to PostgreSQL/S3. No default
"all" selection is provided. Choose exactly one group, independent dataset or tag
intersection. `list` marks definitions that require group-provided dependencies.

## Fill a Workspace

Prepare the business schema and approved native DDL explicitly first. Then opt the
intended development/test database into seed. Replace the example database name
with the actual connected database name:

```powershell
pnpm db:seed init --env dev.local --database talosark_dev --purpose development
pnpm db:seed apply --group business-demo --namespace demo-v3 --env dev.local --database talosark_dev --credentials-output ../../output/seed/demo-v3.private.json --output ../../output/seed/demo-v3.json
pnpm db:seed verify --group business-demo --namespace demo-v3 --env dev.local --database talosark_dev
```

Without `--actor`, ordinary groups create a real local account and organization /
workspace. Governance groups own isolated personas and scopes. No group creates a
system administrator or adds the current browser user automatically.

Use `--actor <uuid>` for an existing account. Also supply `--organization <uuid>`
and `--workspace <uuid>` to fill an existing workspace. The actor must already
have the required grants. Seed does not repair grants or adopt existing rows.
Scope modes unsupported by a group are rejected during planning.

Database configuration comes only from Prisma profiles in `ops/prisma/env`, never
an implicit runtime profile. Connected actions require `--database`; CI requires
`--env` or `--env-file`. Interactive selection belongs to the CLI, not the SDK.
`init` creates/upgrades only `seed.target`, `seed.run`, `seed.record` and `seed.operation`; it does
not apply business tables, DDL, extensions or reset data.

Account/invitation writes require `--credentials-output`. Passwords are random and
hashed through Identity. The explicit private JSON stores plaintext credentials;
there is no encryption, secret table or separate key management. No mail is sent.
New output destinations must not already exist and are reserved before business writes.
POSIX private-file mode is `0600`;
Windows directory ACLs remain the operator's responsibility. Never commit them.
`--output` contains ordinary IDs/references, not passwords or invitation tokens.

Credentials are saved incrementally, not just in a final export. Pre-generated
passwords are saved before account creation; activation tokens are captured before
its transaction commits. The JSON includes the namespace, fingerprint and account
status: `prepared` is not proof that the account exists; `committed` acknowledges
its receipt. A pending password change retains both the previous password and the
candidate until confirmation. Individual updates replace the previous JSON through
a flushed temporary file. This is not atomicity between PostgreSQL and the filesystem.
Invitation delivery remains an after-commit callback; a hard kill in that gap can
lose its token. Governance/credential workflows consequently do not support resume.
Lost plaintext credentials cannot be reconstructed from database hashes or receipts.

## Inspect, Cancel and Resume

Execution and artifact delivery have independent outcomes. A report-export failure
does not mean business writes rolled back, and must not be repaired by rerunning
the business operations. Every write attempt has a ULID; receipts survive failure.
Final snapshots and the completed state are sealed together in one transaction.

SIGINT/SIGTERM stop new operations. In-flight database transactions finish or time
out; external operations retain their intent/checkpoint. Already committed work
is not rolled back. Connection/control loss or an unconfirmed outcome is reported
as `uncertain`, not treated as permission to replay.

```powershell
pnpm db:seed status --namespace demo-v3 --env dev.local --database talosark_dev
pnpm db:seed report --namespace demo-v3 --env dev.local --database talosark_dev --output ../../output/seed/demo-v3-report-retry.json
pnpm db:seed resume --group material-demo --namespace materials-v3 --env dev.local --database talosark_dev --credentials-output ../../output/seed/materials-v3.private.json --output ../../output/seed/materials-v3-resumed.json
```

`status` reads tool metadata only. `report` exports the last saved execution report,
without re-verifying data, loading business providers or regenerating credentials.
Historical runs without a saved report can use `verify` with their original plan.

`resume` is explicit, never an automatic retry. It rebuilds the exact original plan,
checks every reachable committed receipt, and refuses changed/uninspectable facts.
Confirm the previous process has exited before taking over an interrupted attempt;
the advisory lock is not a distributed cancellation mechanism for remote requests.
Use the original credentials JSON for this namespace/fingerprint, not a new file.
Saved active-account passwords are authenticated before replay is allowed. Missing
credentials block recovery; no password reset or token reissue is performed.

Only `account`, `workspace`, `material`, `batch` and `attachment` handlers currently
opt into recovery. A plan containing another handler is rejected before business
replay. This covers minimal/material compositions and attachment integration, not
all daily-demo, governance, inventory-history or approval scenarios.

Run the explicit `init` command once to upgrade existing tool metadata. Execution
version 2 is independent of manifest format 3. Existing version-1 runs remain
inspectable/verifiable but cannot be resumed or retroactively adopted. No upgrade
is executed by apply/verify/resume, application startup or `db:push`.

Partial verification reports `verified`, `unsealed`, `missing`, `changed` and
`blocked`. Known receipts are still inspected when a later receipt is missing;
independent steps continue. Missing dependency outputs are not fabricated. An
unsealed creation snapshot is not presented as a verified final baseline.
CLI exit codes: 0 completed, 1 failure/delivery or cleanup error, 2 partial
verification, 130 cancellation. SDK `run`/`resume` return structured outcomes after
execution starts; callers must check `execution`, `delivery` and diagnostics.
Invalid plans/guards can still throw before execution.

## Data Groups

| Group | Purpose and contents |
| --- | --- |
| `minimal` | Account if needed, organization/workspace and real initial roles |
| `material-demo` | 20 consumables, 15 chemicals and 15 biological materials |
| `material-regression` | Unicode, long names, nullable/legacy-style codes, archives |
| `material-volume` | Explicit `count` required, up to 10000; optional branch |
| `lab-demo` | 15 chemicals, cabinet/positions and real stock receipts |
| `governance-demo` | Regression: 12 accounts, two organizations/four workspaces, roles, memberships, invitations and positive/negative access assertions |
| `business-demo` | Daily demo: governance, three material branches, isolated scope, batches, facilities, inventory history and approvals; no bulk volume or S3 |
| `governance-volume` | Explicit member `count` required, up to 199 plus an owner |
| `inventory-volume` | Explicit stock-item `count` required, up to 100, with exclusive positions |
| `credential-regression` | Activation, password verification and revoked/consumed recovery credentials |
| `attachment-integration` | Actual local-file/single/multipart uploads, binding, download/hash verification and unbinding |

`authorization-regression` was an identical alias of governance-demo, not distinct
coverage, and has been merged into it. Use `governance-demo` and a new namespace.
Regression and integration data stay explicitly selectable rather than silently
joining the daily demo. See [coverage.md](coverage.md) for unavailable capabilities.

For volume parameters, create a JSON file containing, for example,
`{"count":100,"branch":"chemical"}`:

```powershell
pnpm db:seed plan --group material-volume --namespace volume-v3 --params-file ./volume.json
pnpm db:seed plan --dataset chemical-demo --namespace chemical-v3
pnpm db:seed plan --tag material demo --namespace tagged-v3
```

Tags classify independently selectable datasets; they do not infer dependencies.
A tag selection including volume data is rejected rather than using an implicit
large count. Use an explicit dataset/group and count instead.

## Real File Inputs

Attachment integration defaults to the fictional sample
`fixture/file/material/notes.txt`, a generated multipart CSV and an unbound text
attachment. To upload an actual local PDF/image, select an allowed root and supply
a relative logical ID and the matching allowed filename/MIME in a parameter file:

```json
{
  "fixtureId": "material/ethanol-sds.pdf",
  "filename": "ethanol-sds.pdf",
  "contentType": "application/pdf"
}
```

```powershell
pnpm db:seed plan --group attachment-integration --namespace file-v3 --fixture-root F:/seed-fixture --params-file ./attachment.json
pnpm db:seed apply --group attachment-integration --namespace file-v3 --fixture-root F:/seed-fixture --params-file ./attachment.json --env dev.local --database talosark_dev --storage-env dev.local --credentials-output ../../output/seed/file-v3.private.json
```

`--storage-env` explicitly reads the selected runtime profile into an isolated
object, consumes only the storage schema and does not populate `process.env` or
start AppModule. Alternatively use `--storage-config <private-json-path>` with
`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and optional `S3_REGION`,
`S3_BUCKET_PRIVATE`, `S3_BUCKET_STAGING`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_BASE_URL`.
These options are mutually exclusive. Storage is required only for plans declaring
object-storage; unrelated plans reject an unnecessary storage source.

Use nonproduction buckets already provisioned with the normal storage tooling.
Seed does not create buckets/CORS. Storage credentials are not plan parameters.
Actual business size/extension/MIME policies still apply, including no SVG.

File references are relative IDs, not URLs or FileAsset IDs. The reader rejects
missing files, path/realpath escapes and files over 100 MiB; hashing is streamed.
Run copies each input to a private temporary snapshot **before business writes**
and uploads that snapshot, not a later reread of a mutable original. Snapshots are
released on exit/failure. A manifest contains only logical ID, size and SHA-256,
never an absolute path or file bytes. Remote URL inputs are not supported.

Each attachment explicitly selects a `materialKey`. The adapter calls the real
begin/sign/upload/complete/bind/download APIs. It does not insert FileObject,
FileAsset or FileReference rows. A source hash does not grant asset reuse across
materials. Upload/download streams are bounded; multipart remains supported.

External publication and the seed receipt are not atomic. The adapter uses
`execution.external()` without an outer transaction across network I/O. A persistent
intent keeps the same upload idempotency key; recovery inspects that session,
reuses confirmed multipart parts, handles completed publication/binding and retains
the download-verification checkpoint before unbinding. Cancelled/expired sessions
and unconfirmable bindings stop recovery instead of creating a replacement upload.
Normal file cleanup remains necessary for abandoned objects. Verify checks persisted
final facts, not every remote object's current bytes; the initial download verifies size/hash.

## Architecture and Extension

```text
CLI / SDK -> SeedApplication -> SeedPlanner -> pure catalog / groups / datasets
                 |
                 +-> fixture resolution and snapshot -> sealed manifest
                 +-> guarded target -> selected runtime contributions -> Runner
                                                                -> business services
```

| Directory | Owns |
| --- | --- |
| `definition/` | Pure dataset/kind/group/ref contracts and deterministic generation |
| `plan/` | Catalog, selection validation, draft/program and serializable manifest |
| `application/` | One list/plan/run entry and resource lifecycle |
| `fixture/` | Pure file references, bounded reader/snapshot and fictional samples |
| `capability/<domain>/` | Adjacent kind/dataset/factory/seeder/runtime/contribution |
| `group/` | Explicit typed compositions and baseline helpers |
| `runtime/` | Guarded execution, transactional receipts, explicit recovery, private files and runtime lifecycle |
| `cli/` | Terminal arguments, interaction and reporting only |
| `typecheck/` | Existing compile-only contract rejection probes |

Pin `defineDatasetFor(kind)` before defining raw authored data. Kinds derive from
contracts or kernel input types, use `z.input` for defaultable input and `z.output`
for normalized data, and carry a semantic version. Do not cast away contract errors.

Groups use `defineGroup` with their own parameter schema and scope modes. Example
inside a group builder, with a typed `chemicalDemo` dataset:

```ts
const scope = addWorkspaceBaseline(builder);
const material = builder.step('chemical', chemicalDemo, {}, {
    from: { scope },
    bind: ({ scope }) => scope,
});
builder.expose({ primaryScope: scope, materials: material });
```

`step` pins parameters/input/output with `NoInfer`. `from` names dependencies;
only references already created by this builder are accepted. Duplicate keys,
foreign references, unregistered definitions and incompatible kind versions fail
before writes. There is no topology solver, implicit dependency repair or parallel
execution. Business input validation still runs after upstream outputs exist.

Each capability has a pure `.contribution.ts` and lazy `.runtime.ts`. The central
`plan/product.catalog.ts` lists them explicitly. `provideSeedHandler(kind, Seeder)`
keeps the class/actor signature tied to its kind and creates its binding provider;
`seed.module.ts` composes those bindings rather than parallel inject lists.
Only selected capabilities load. Normal Nest imports own their internal dependencies.
`src/bootstrap/composition/product-policy.ts` shares unchanged product role defaults
between app and seed, regardless of selected seed handlers.

## SDK and Fingerprints

The public entry is `tooling/seed/index.ts`; do not import Runner/Target to execute
around its guards. SDK callers explicitly choose their environment and artifact
destinations, with no terminal prompt:

```ts
const seed = new SeedApplication();
const plan = {
    selection: { kind: 'group', id: 'business-demo' },
    namespace: 'demo-v3',
    generation: { seed: 42, referenceDate: '2026-01-01' },
    scope: { kind: 'provision' },
} satisfies SeedPlanRequest;
const preview = await seed.plan(plan);
const result = await seed.run({
    plan, mode: 'apply', expectedFingerprint: preview.fingerprint,
    target: { environment: { kind: 'profile', name: 'dev.local' }, expectedDatabase: 'talosark_dev' },
    artifacts: { output: 'demo.json', credentialsOutput: 'demo.private.json' },
});
if (result.execution !== 'completed' || result.delivery === 'failed') {
    throw new Error('Seed did not complete cleanly; inspect result.diagnostics and retained receipts');
}
```

Manifest format **3** is JSON describing intent, versions, ordered steps, explicit
references, capabilities, resource requirements, exposed outputs and file facts.
The internal Program additionally holds frozen normalized data and bind/parser
functions. A manifest is not a self-contained executable/importable data package.

The fingerprint includes normalized request, versions, content hashes, references,
step order and file hashes. It excludes credentials, connections, absolute paths,
runtime timestamps and generated database IDs. Binding/function source is not
hashed: bump the group/kind version when its semantics change.

`run` always rebuilds the Program. `--expected-fingerprint <hash>` (or the SDK
property) rejects drift before opening a database connection. File previews are
asynchronous because they perform local IO, not database/S3 IO.

## Safety and Verification

Format 1/2 namespaces are rejected explicitly, without adopting, deleting or
replaying old records. Choose a new namespace. A format-3 namespace belongs to one
exact plan; changed content/scope/parameters/versions reject. Completed apply/resume
becomes read-only verification without creating an empty credentials file. Use
`report --output <new-path>` to re-export a saved result, or `verify` for fresh checks.

The existing DB name/OID/role/purpose marker and advisory lock remain mandatory.
Production profiles and `NODE_ENV=production` reject. Opt-in is not proof that a
database has no production data. Seed does not offer reset, automatic replay or
blanket rollback. Reference dates control generated content, not business time.

`pnpm seed:typecheck` checks the seed graph and existing compile-only rejection
probes without DB access. A-group validation covers isolated build, offline plans,
fingerprints, input guards, all 11 runtime DI assemblies and real local HTTP
streamed PUT/download checks (including empty files and multipart). Those HTTP
checks simulate business services/S3, not a full persistence acceptance. Earlier real PostgreSQL/S3
verification is historical evidence, not a new end-to-end acceptance of this
refactor; rerun in an explicitly authorized disposable environment before relying
on new real-file uploads in routine use.

C-group validation additionally covers all 11 offline group plans, incremental
credential files and execution/recovery behavior using in-memory persistence and
fetch substitutes. No maintained test scripts were added. These checks do not
validate native metadata SQL or real PostgreSQL/S3 concurrency. The host closes
the Nest context once creation returns it; a failure during Nest construction
before that handle is returned remains a framework lifecycle limitation.
