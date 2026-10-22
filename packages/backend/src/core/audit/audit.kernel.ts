import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import type {
    AuditListInput,
    AuditPage,
    AuditReceipt,
    AuditRecordInput,
} from './audit.contract.js';
import { AuditRepository } from './internal/audit.repository.js';
import { parseAuditList, parseAuditRecord } from './internal/audit.input.js';
import { readAuditCursor, writeAuditCursor } from './internal/audit.cursor.js';
import { observeAudit } from './internal/audit.telemetry.js';

@Injectable()
export class AuditKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly repository: AuditRepository
    ) {}

    record(input: AuditRecordInput): Promise<AuditReceipt> {
        return observeAudit('append', () =>
            this.database.transaction.run(
                async () => this.repository.append(parseAuditRecord(input)),
                { propagation: 'mandatory' }
            )
        );
    }

    async list(input: AuditListInput): Promise<AuditPage> {
        return observeAudit('list', async () => {
            const query = parseAuditList(input);
            const rows = await this.repository.list(query, readAuditCursor(query));
            const items = rows.slice(0, query.limit);
            return {
                items,
                nextCursor:
                    rows.length > query.limit
                        ? writeAuditCursor(query, items[items.length - 1])
                        : null,
            };
        });
    }
}
