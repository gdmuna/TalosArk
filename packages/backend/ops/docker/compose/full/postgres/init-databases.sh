#!/bin/sh
set -eu

require_database_name() {
    case "$1" in
        '' | *[!A-Za-z0-9_]* | [0-9]*)
            echo "Invalid database name: $1" >&2
            exit 1
            ;;
    esac
}

create_database_if_missing() {
    database_name="$1"
    require_database_name "$database_name"

    exists="$(psql --username "$POSTGRES_USER" --dbname postgres --tuples-only --no-align \
        --command "SELECT 1 FROM pg_database WHERE datname = '$database_name';")"

    if [ "$exists" != '1' ]; then
        psql --username "$POSTGRES_USER" --dbname postgres \
            --command "CREATE DATABASE \"$database_name\";"
    fi
}

create_database_if_missing "$POSTGRES_SHADOW_DB"
create_database_if_missing "$CASDOOR_DB"
