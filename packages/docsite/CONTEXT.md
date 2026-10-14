
# Docsite context

packages/docsite owns published documentation and its delivery. Internal backend
architecture/design/review documents remain in packages/backend/docs; they are
not implicitly copied into this site.

## Current state

The site publishes current status and runtime/delivery instructions in Chinese
and English. The backend configuration reference currently covers an overview,
loading rules, and all ten HTTP configuration inputs, with matching Chinese and
English routes and variable anchors. Other configuration groups remain design
material outside docs/. Navigation must point to existing pages. Do not restore
the legacy scaffold's guides, feature claims or missing assets merely to satisfy its old
navigation configuration.

## OpenAPI delivery

The runtime contract source is backend's /api-doc-json. The backend export script
validates a basic OpenAPI 3 structure and atomically writes
packages/docsite/api-reference/openapi.json. It does not decrypt runtime env.

script/prepare-api-reference.mjs prepares the Scalar index and specification in
docs/public/api-reference before dev/build. VitePress publishes them to
dist/api-reference; both generated locations are ignored by Git. Local builds
require a valid specification unless VITE_API_REFERENCE_URL selects external
HTTP(S) documentation.

Scalar reads ./openapi.json. nginx must return 404 for missing reference assets,
never the document HTML fallback. Default images serve the root path; subpath
deployments require the reverse proxy to strip VITE_BASE_PATH's prefix.

Dockerfile.prod always includes the local specification. Dockerfile.dev retains
the existing external Apifox default and may opt into local reference mode.
Both use the root packageManager and frozen lockfile. No backend source, runtime
env, private key or .git is copied into these docsite images.

CD hands over the specification exported from its exact backend image digest.
Export runs only disposable dependencies and synthetic configuration, without
business DDL or real provider calls. Existing Apifox synchronization is retained.
Full workflow execution and real provider verification are separate evidence
from local builds or export success.
