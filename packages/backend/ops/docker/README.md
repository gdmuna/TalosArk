# Docker operations

Each Compose layout is a self-contained directory. Its `compose.yaml`, Compose
input file, Casdoor configuration, and any layout-specific bootstrap scripts
live together; shared backend build assets remain in this directory.

```text
docker/
├── Dockerfile                         # shared backend image build
├── apt/                               # Debian source definitions used by Dockerfile
└── compose/
    ├── full/
    │   ├── compose.yaml               # backend + PostgreSQL + Valkey + RustFS + Casdoor
    │   ├── .env.example
    │   ├── casdoor/app.conf.example
    │   ├── postgres/init-databases.sh
    │   └── backend/docker-entrypoint.sh
    └── dev/
        ├── compose.yaml               # Valkey + Casdoor for local backend development
        ├── .env.example
        └── casdoor/app.conf.example
```

Each Compose directory has a `.env` input file. Docker Compose automatically
uses it to resolve `${...}` on the host when it is run from that directory; it
is not mounted into any container. Casdoor instead reads its explicitly mounted
`casdoor/app.conf`.

Full Compose publishes Casdoor's actual port 8000 and keeps its probe on that
same container port. BACKEND_PORT and CASDOOR_PORT change host publication only;
the backend explicitly listens on container port 3000. With a non-default
Casdoor host port, update app.conf origin and the browser-facing OIDC settings
to match. Do not use an internal Compose hostname as a browser login address.

## Full environment

Run from the full Compose directory:

```sh
cd packages/backend/ops/docker/compose/full
cp .env.example .env
cp casdoor/app.conf.example casdoor/app.conf
docker compose up -d
```

`.env` configures the image tags, PostgreSQL superuser and databases,
host ports, and RustFS credentials. It and the local Casdoor configuration are
ignored by Git. Keep the PostgreSQL values in `.env` consistent with
`dataSourceName` and `dbName` in `casdoor/app.conf`.

`postgres/init-databases.sh` creates the Prisma shadow database and separate
Casdoor database only when the `postgres-data` volume is initialized for the
first time; it is not a migration mechanism for an existing volume.

The backend connects to PostgreSQL, Valkey, and RustFS through their internal
Compose service names. For browser-direct uploads, configure an S3 endpoint
reachable by both browser and backend, normally through a reverse proxy or a
public S3 hostname.

### Backend configuration and keys

The image retains `secrets/env/.env.*`, including the approved plaintext local
development profiles. These local values are readable by anyone holding the
image; distribute it only within the intended development trust boundary.
The backend still loads the profile selected by `NODE_ENV` through dotenvx.

Decryption keys and the entire `secrets/crypto` directory are excluded from the
build context. Full Compose mounts `secrets/env/.env.keys` at
`/talos-ark/.env.keys` and `secrets/crypto` at `/talos-ark/secrets/crypto`, both
read-only. The source file and directory must already exist and be readable by
the container's `node` user. Without Compose, provide equivalent runtime mounts
or inject the matching `DOTENV_PRIVATE_KEY_*` environment variable separately.
Keep certificate paths relative to the backend working directory unchanged.

Prisma generation uses the Dockerfile's synthetic database URLs. Do not pass
real credentials as build arguments; schema synchronization is not part of the
image build. This change does not remove existing images or rotate credentials.

### Health and shutdown

The image and Full Compose probe `/api/v1/health/ready`. It reports process
initialization and shutdown state, not live database/provider health.
`/api/v1/health/live` only reports that the HTTP handler can run. Both are public,
unthrottled ApiRoute endpoints with validated response envelopes.

The Node shutdown budget defaults to 10 seconds: up to 5 seconds for HTTP drain,
2 seconds for KVS close, with 500 milliseconds reserved for Pino flush. Configuration
keys and verification limits are documented in
[`backend-w03-2026-10-11.md`](../../docs/design/backend-w03-2026-10-11.md).
Remaining resource hooks, including Prisma disconnect, share the total deadline.

The entrypoint uses `setpriv` to exec as `node`, avoiding `runuser`'s extra signal
proxy and two-second forced termination. Full Compose allows 15 seconds for stop;
use at least the same grace period for standalone Docker deployments and adjust it
when increasing the application budget. Timeout/error shutdowns exit nonzero.

## Local development dependencies

Run from the development Compose directory:

```sh
cd packages/backend/ops/docker/compose/dev
cp .env.example .env
cp casdoor/app.conf.example casdoor/app.conf
docker compose up -d
```

This layout starts only Valkey and Casdoor. Casdoor joins the external network
named by `POSTGRES_NETWORK` and connects to the shared `dev-infra` PostgreSQL
service through the hostname configured in `casdoor/app.conf`; it does not run
SQLite or start another PostgreSQL container.

Stop either layout from its own directory with `docker compose down`. Add `-v`
only when intentionally discarding persistent local data.

## Documentation export in CD

From the repository root, use
`bash packages/backend/ops/docker/ci/export-openapi.sh <backend-image>` to export
OpenAPI from an image. Linux, Docker CLI/daemon and OpenSSL are required.
The CD workflows pass the digest of the image built in that run, not a moving
latest tag. The helper starts uniquely named disposable PostgreSQL and Valkey
containers on a private network, generates temporary access-token keys and a
certificate, and starts backend with an explicit synthetic env file. It invokes
the normal entrypoint and compiled application, but intentionally does not load
the packaged runtime profiles or real decryption keys.

No ports are published, no existing data volume is used, and no business DDL is
executed. Provider/storage addresses are non-routable fixtures; this verifies
startup and document export, not real OIDC or storage operations. Cleanup stops
the owned backend with the existing 15-second grace and removes its containers,
anonymous volumes, network and temporary keys even when export fails.

The artifact is written to packages/docsite/api-reference/openapi.json. Docsite
publishing, Scalar and nginx consume that file; see
[docsite README](../../../../docsite/README.md). GitHub Actions execution, registry
pushes and production rollout remain separate from local delivery verification.
