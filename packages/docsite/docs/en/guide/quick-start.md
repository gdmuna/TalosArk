# Runtime and Delivery

## Prerequisites

Use Node.js 24+ and the pnpm version declared in the repository's package.json.
The backend requires PostgreSQL, KVS, access-token signing keys, complete Casdoor settings and its certificate.
Casdoor is currently required at startup; S3 settings must also pass configuration validation.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @talos-ark/backend db:gen-client --env-file ops/prisma/env/.env.development.local
pnpm --filter @talos-ark/backend start:local
```

Client generation does not initialize business tables. Follow backend/ops/prisma/README.md for explicitly authorized database operations.
Do not run db:push or legacy migrations just to export documentation.

## Health and Shutdown

With the default backend port of 3000:

- /api/v1/health/live indicates that the process can handle HTTP.
- /api/v1/health/ready indicates completed initialization and no shutdown in progress, not continuous dependency health.
- /api-doc-json serves the current specification; /reference provides the live Scalar viewer.

The Node shutdown budget is 10 seconds, including up to 5 seconds for HTTP draining, 2 seconds for KVS closing,
and 500 milliseconds reserved for logging. Full Compose provides a 15-second stop grace period.
Backend and Casdoor listen on container ports 3000 and 8000 respectively.

## Static Documentation

Start the backend, then run:

```sh
pnpm --filter @talos-ark/backend docs:gen-openapi
pnpm --filter @talos-ark/docsite build
pnpm --filter @talos-ark/docsite preview
```

Set BACKEND_URL for a non-default endpoint. Export does not decrypt backend environment files.
A validated document atomically replaces packages/docsite/api-reference/openapi.json; failed exports preserve the previous file.

The build publishes the Scalar page and specification under dist/api-reference/.
Scalar fetches ./openapi.json, supporting a proxy-provided base path.
Missing specifications must return 404 rather than the VitePress HTML fallback.

## Images and CI

```sh
docker build -f packages/docsite/Dockerfile.prod -t talos-ark-docsite:local .
docker run --rm -p 127.0.0.1:8080:8080 talos-ark-docsite:local
```

Production requires an exported specification. Dockerfile.dev retains its external Apifox link by default;
set the VITE_API_REFERENCE_URL build argument to /api-reference/ to publish a local specification.
VITE_BASE_PATH changes VitePress links; for a subpath deployment the reverse proxy must strip that prefix before forwarding to nginx.

CD exports from the exact backend image digest using disposable PostgreSQL, Valkey and synthetic configuration.
It does not call a real identity provider or initialize business tables. The artifact feeds the documentation build and existing Apifox synchronization.
