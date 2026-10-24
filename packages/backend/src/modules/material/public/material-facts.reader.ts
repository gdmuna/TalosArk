import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';

const select = {
    id: true,
    resourceId: true,
    organizationId: true,
    workspaceId: true,
    name: true,
    code: true,
    quantityUnit: true,
    quantityScale: true,
    archivedAt: true,
} as const;

@Injectable()
export class MaterialFactsReader {
    constructor(private readonly database: DatabaseRuntime) {}
    byId(id: string) {
        return this.database.queryClient.material.findUnique({ where: { id }, select });
    }
    byResourceId(resourceId: string) {
        return this.database.queryClient.material.findFirst({ where: { resourceId }, select });
    }
}
