-- Database initialization only; run before creating models that use native types.
BEGIN;
SET LOCAL search_path = public, pg_temp;

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension extension
        JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
        WHERE extension.extname = 'ltree' AND namespace.nspname <> 'public'
    ) THEN
        RAISE EXCEPTION 'ltree must be installed in public; review the existing extension schema first';
    END IF;
END;
$$;

COMMIT;
