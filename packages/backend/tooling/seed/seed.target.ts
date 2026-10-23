import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import type { SeedPlan } from './seed.runner.js';

interface Identity {
    database_name: string;
    database_oid: number;
    role_name: string;
    recovery: boolean;
}
interface Marker {
    database_name: string;
    database_oid: number;
    role_name: string;
    purpose: string;
}

/** Holds a dedicated session lock for the entire run; no business transaction stays open. */
export class SeedTarget {
    private constructor(
        readonly client: Client,
        private readonly identity: Identity
    ) {}

    static async open(url: string, expectedDatabase: string): Promise<SeedTarget> {
        const client = new Client({
            connectionString: url,
            application_name: 'talosark-seed',
            connectionTimeoutMillis: 10000,
            query_timeout: 10000,
        });
        try {
            await client.connect();
            const {
                rows: [identity],
            } = await client.query<Identity>(
                'SELECT current_database() AS database_name, (SELECT oid FROM pg_database WHERE datname = current_database()) AS database_oid, current_user AS role_name, pg_is_in_recovery() AS recovery'
            );
            if (identity.database_name !== expectedDatabase || identity.recovery)
                throw new Error(
                    'Connected database does not match --database or is a read replica'
                );
            const {
                rows: [lock],
            } = await client.query<{ locked: boolean }>(
                "SELECT pg_try_advisory_lock(hashtextextended('talosark.seed', 0)) AS locked"
            );
            if (!lock.locked)
                throw new Error('Another seed command is already using this database');
            return new SeedTarget(client, identity);
        } catch (error) {
            await client.end().catch(() => {});
            throw error;
        }
    }

    async initialize(purpose: 'development' | 'test', schemaPath: string): Promise<void> {
        await this.client.query('BEGIN');
        try {
            await this.client.query(await readFile(schemaPath, 'utf8'));
            await this.client.query(
                'INSERT INTO seed.target(singleton, database_name, database_oid, role_name, purpose) VALUES (true, $1, $2::oid, $3, $4) ON CONFLICT (singleton) DO NOTHING',
                [
                    this.identity.database_name,
                    this.identity.database_oid,
                    this.identity.role_name,
                    purpose,
                ]
            );
            await this.requireMarker(purpose);
            await this.client.query('COMMIT');
        } catch (error) {
            await this.client.query('ROLLBACK');
            throw error;
        }
    }

    private async requireMarker(expectedPurpose?: string): Promise<void> {
        const {
            rows: [installed],
        } = await this.client.query<{ installed: boolean }>(
            "SELECT to_regclass('seed.target') IS NOT NULL AS installed"
        );
        if (!installed.installed)
            throw new Error('This database has not opted into seeding. Run db:seed init first.');
        const {
            rows: [marker],
        } = await this.client.query<Marker>(
            'SELECT database_name, database_oid, role_name, purpose FROM seed.target WHERE singleton'
        );
        if (
            !marker ||
            marker.database_name !== this.identity.database_name ||
            Number(marker.database_oid) !== Number(this.identity.database_oid) ||
            marker.role_name !== this.identity.role_name ||
            !['development', 'test'].includes(marker.purpose) ||
            (expectedPurpose && marker.purpose !== expectedPurpose)
        )
            throw new Error(
                'Seed target marker does not match this database, role or purpose; automatic adoption is disabled'
            );
    }

    async preflight(plan: SeedPlan): Promise<void> {
        await this.requireMarker();
        const {
            rows: [metadata],
        } = await this.client.query<{ present: boolean }>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'seed' AND table_name = 'record' AND column_name = 'final_snapshot_hash') AS present"
        );
        if (!metadata.present)
            throw new Error(
                'Seed metadata is outdated; rerun db:seed init to install the final-state snapshot column'
            );
        const tables = [
            'User',
            'Organization',
            'Workspace',
            'Role',
            'MaterialType',
            'Material',
            'ResourceIdentity',
            'AuditEvent',
        ];
        if (plan.steps.some((step) => step.seederId === 'account'))
            tables.push('UserProfile', 'UserActivationToken');
        if (plan.steps.some((step) => step.seederId === 'credential'))
            tables.push('PasswordResetToken');
        if (plan.steps.some((step) => step.seederId === 'attachment'))
            tables.push('FileObject', 'FileAsset', 'FileReference', 'FileUploadSession');
        if (plan.steps.some((step) => step.seederId === 'team'))
            tables.push(
                'OrganizationMember',
                'WorkspaceMember',
                'OrganizationInvitation',
                'RolePermission',
                'WorkspaceRoleBinding',
                'OrganizationRoleBinding'
            );
        if (plan.steps.some((step) => step.seederId === 'batch')) tables.push('MaterialBatch');
        if (plan.steps.some((step) => step.seederId === 'approval'))
            tables.push('ApprovalRequest', 'ApprovalLine', 'ApprovalEvent', 'ApprovalOperation');
        if (plan.steps.some((step) => step.seederId === 'facility'))
            tables.push('Facility', 'StorageTopology', 'StorageNode');
        if (plan.steps.some((step) => step.seederId === 'receipt'))
            tables.push('StockItem', 'Placement', 'InventoryOperation', 'InventoryTransaction');
        const { rows } = await this.client.query<{ name: string; present: boolean }>(
            `SELECT name, to_regclass(format('public.%I', name)) IS NOT NULL AS present FROM unnest($1::text[]) AS name`,
            [tables]
        );
        const missing = rows.filter((row) => !row.present).map((row) => row.name);
        const constraints = ['User_email_normalized_check', 'Material_quantityScale_check'];
        if (plan.steps.some((step) => step.seederId === 'receipt'))
            constraints.push(
                'MaterialInstance_initialQuantity_check',
                'StockItem_quantity_check',
                'StockItem_status_quantity_check',
                'InventoryOperation_scope_check'
            );
        const checks = await this.client.query<{ conname: string }>(
            `SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[]) AND connamespace = 'public'::regnamespace AND convalidated`,
            [constraints]
        );
        missing.push(
            ...constraints.filter((name) => !checks.rows.some((row) => row.conname === name))
        );
        if (plan.steps.some((step) => step.seederId === 'facility')) {
            const {
                rows: [ltree],
            } = await this.client.query<{ present: boolean }>(
                "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'ltree') AS present"
            );
            if (!ltree.present) missing.push('ltree extension');
            const triggers = await this.client.query<{ tgname: string }>(
                `SELECT tgname FROM pg_trigger WHERE tgrelid = to_regclass('public."StorageNode"') AND tgenabled <> 'D'`
            );
            for (const name of ['storage_node_guard', 'storage_node_validate'])
                if (!triggers.rows.some((row) => row.tgname === name)) missing.push(name);
        }
        if (missing.length)
            throw new Error(
                `Database prerequisites are missing: ${missing.join(', ')}. Apply the approved schema/DDL explicitly before seeding.`
            );
    }

    close(): Promise<void> {
        return this.client.end();
    }
}
