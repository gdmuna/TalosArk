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
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'uncertain')),
    execution_version integer NOT NULL DEFAULT 2,
    attempt_id text,
    report jsonb,
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

-- Existing receipts remain readable, but cannot acquire recovery guarantees retroactively.
ALTER TABLE seed.run ADD COLUMN IF NOT EXISTS execution_version integer NOT NULL DEFAULT 1;
ALTER TABLE seed.run ADD COLUMN IF NOT EXISTS attempt_id text;
ALTER TABLE seed.run ADD COLUMN IF NOT EXISTS report jsonb;
ALTER TABLE seed.run DROP CONSTRAINT IF EXISTS run_status_check;
ALTER TABLE seed.run ADD CONSTRAINT run_status_check
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'uncertain'));

CREATE TABLE IF NOT EXISTS seed.operation (
    namespace text NOT NULL REFERENCES seed.run(namespace),
    step text NOT NULL,
    key text NOT NULL,
    idempotency_key uuid NOT NULL,
    checkpoint jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY (namespace, step, key)
);
