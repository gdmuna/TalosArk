#!/usr/bin/env bash
set -euo pipefail

# Runs only disposable containers with synthetic settings; no business DDL.
image="${1:?Usage: export-openapi.sh backend-image}"
repository="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
work="$(mktemp -d)"
prefix="talos-ark-openapi-$(basename "$work" | tr '[:upper:]' '[:lower:]')"
network=""
backend=""
postgres=""
valkey=""
smtp=""

cleanup() {
    status=$?
    if [ -n "$backend" ]; then
        if [ "$status" -ne 0 ]; then docker logs --tail 80 "$backend" || true; fi
        docker stop --time 15 "$backend" >/dev/null 2>&1 || true
        docker rm -fv "$backend" >/dev/null 2>&1 || true
    fi
    for container in "$postgres" "$valkey" "$smtp"; do
        if [ -n "$container" ]; then docker rm -fv "$container" >/dev/null 2>&1 || true; fi
    done
    if [ -n "$network" ]; then docker network rm "$network" >/dev/null 2>&1 || true; fi
    rm -f "$work/access-private.pem" "$work/access-public.pem" "$work/casdoor-private.pem" "$work/certificate.pem" "$work/backend.env"
    rmdir "$work"
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

umask 077
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$work/access-private.pem"
openssl pkey -in "$work/access-private.pem" -pubout -out "$work/access-public.pem"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$work/casdoor-private.pem"
openssl pkey -in "$work/casdoor-private.pem" -pubout -out "$work/certificate.pem"
chmod 444 "$work/certificate.pem"

network="$(docker network create "$prefix")"
postgres="$(docker run -d --name "$prefix-postgres" --network "$prefix" --network-alias postgres \
    -e POSTGRES_USER=openapi -e POSTGRES_PASSWORD=openapi -e POSTGRES_DB=openapi postgres:18.6-trixie)"
valkey="$(docker run -d --name "$prefix-valkey" --network "$prefix" --network-alias valkey valkey/valkey:9.1-trixie)"
smtp="$(docker run -d --name "$prefix-smtp" --network "$prefix" --network-alias smtp axllent/mailpit:v1.27.4)"
for attempt in $(seq 1 30); do
    if docker exec "$postgres" pg_isready -U openapi -d openapi >/dev/null 2>&1 \
        && docker exec "$valkey" valkey-cli ping >/dev/null 2>&1 \
        && docker exec "$smtp" /mailpit readyz >/dev/null 2>&1; then break; fi
    sleep 1
done
docker exec "$postgres" pg_isready -U openapi -d openapi
docker exec "$valkey" valkey-cli ping
docker exec "$smtp" /mailpit readyz

cat > "$work/backend.env" <<EOF
NODE_ENV=test
PORT=3000
DATABASE_URL=postgresql://openapi:openapi@postgres:5432/openapi?schema=public
SHADOW_DATABASE_URL=postgresql://openapi:openapi@postgres:5432/openapi?schema=public
KVS_URL=redis://valkey:6379
JWT_ACCESS_PRIVATE_KEY=$(awk '{printf "%s\\n", $0}' "$work/access-private.pem")
JWT_ACCESS_PUBLIC_KEY=$(awk '{printf "%s\\n", $0}' "$work/access-public.pem")
CASDOOR_ENDPOINT=http://casdoor.invalid:8000
CASDOOR_CLIENT_ID=openapi
CASDOOR_CLIENT_SECRET=openapi
CASDOOR_ORGANIZATION=openapi
CASDOOR_APPLICATION=openapi
CASDOOR_CERTIFICATE_PATH=/tmp/openapi-certificate.pem
CASDOOR_OIDC_REDIRECT_URI=http://localhost:3000/api/v1/auth/oidc/login-callback
S3_ENDPOINT=http://storage.invalid:9000
S3_ACCESS_KEY_ID=openapi
S3_SECRET_ACCESS_KEY=openapi
SMTP_HOST=smtp
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
SMTP_FROM=sender@example.test
LOG_LEVEL=warn
EOF
backend="$(docker create --name "$prefix-backend" --network "$prefix" --env-file "$work/backend.env" \
    "$image" node dist/src/main.js)"
docker cp "$work/certificate.pem" "$backend:/tmp/openapi-certificate.pem"
docker start "$backend" >/dev/null

for attempt in $(seq 1 60); do
    if [ "$(docker inspect -f '{{.State.Running}}' "$backend")" != true ]; then break; fi
    if docker exec "$backend" curl --fail --silent --max-time 2 \
        http://localhost:3000/api/v1/health/ready >/dev/null 2>&1; then break; fi
    sleep 1
done
docker exec "$backend" curl --fail --silent --max-time 2 http://localhost:3000/api/v1/health/ready
docker exec --user node "$backend" mkdir -p /talos-ark/packages/backend/scripts /talos-ark/packages/docsite/api-reference
docker cp "$repository/packages/backend/scripts/generate-openapi.ts" "$backend:/talos-ark/packages/backend/scripts/generate-openapi.ts"
docker exec --user node "$backend" node /talos-ark/packages/backend/scripts/generate-openapi.ts
mkdir -p "$repository/packages/docsite/api-reference"
docker cp "$backend:/talos-ark/packages/docsite/api-reference/openapi.json" "$repository/packages/docsite/api-reference/openapi.json"
echo "OpenAPI exported from $image"
