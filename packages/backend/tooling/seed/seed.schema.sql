-- Development/test tooling only. Never applied by db:init, db:push or application startup.
CREATE SCHEMA IF NOT EXISTS seed;

CREATE TABLE IF NOT EXISTS seed.target (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    database_name text NOT NULL,
    database_oid oid NOT NULL,
    role_name text NOT NULL,
    purpose text NOT NULL CHECK (purpose IN ('development', 'test')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seed.run (
    namespace text PRIMARY KEY,
    plan_hash text NOT NULL,
    plan jsonb NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS seed.record (
    namespace text NOT NULL REFERENCES seed.run(namespace),
    step text NOT NULL,
    key text NOT NULL,
    output jsonb NOT NULL,
    snapshot_hash text NOT NULL,
    final_snapshot_hash text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (namespace, step, key)
);

ALTER TABLE seed.record ADD COLUMN IF NOT EXISTS final_snapshot_hash text;
