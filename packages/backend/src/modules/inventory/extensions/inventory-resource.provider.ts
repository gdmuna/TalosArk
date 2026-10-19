import { Injectable } from '@nestjs/common';
import {
    ResourceExtension,
    type ResourceProvider,
    type ResourceLookup,
} from '@/core/resource/index.js';
import {
    AuthorizationKernel,
    AuthorizationTargetExtension,
    type AuthorizationTargetProvider,
    type AuthorizationTargetQuery,
} from '@/core/authorization/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { materialPermission } from '@/modules/material/public/index.js';
import { inventoryPermission as p } from '../contribution/inventory-authorization.contribution.js';
class StockTarget implements AuthorizationTargetProvider {
    protected instance = false;
    constructor(protected readonly database: DatabaseRuntime) {}
    async resolve({ target, permissionCode }: AuthorizationTargetQuery) {
        if (!Object.values(p).some((code) => code === permissionCode)) return null;
        const row = await this.database.queryClient.stockItem.findFirst({
            where: this.instance ? { instanceId: target.id } : { id: target.id },
            select: { organizationId: true, workspaceId: true },
        });
        return row ? { scope: { kind: 'workspace' as const, ...row } } : null;
    }
}
@Injectable()
@AuthorizationTargetExtension({ kind: 'stock-item' })
export class StockTargetProvider extends StockTarget {
    constructor(database: DatabaseRuntime) {
        super(database);
    }
}
@Injectable()
@AuthorizationTargetExtension({ kind: 'material-instance' })
export class InstanceTargetProvider extends StockTarget {
    protected instance = true;
    constructor(database: DatabaseRuntime) {
        super(database);
    }
}
class StockResource implements ResourceProvider {
    protected instance = false;
    constructor(
        protected readonly database: DatabaseRuntime,
        protected readonly authorization: AuthorizationKernel
    ) {}
    async describe(input: ResourceLookup) {
        const row = await this.database.queryClient.stockItem.findFirst({
            where: this.instance
                ? { instance: { resourceId: input.resourceId } }
                : { resourceId: input.resourceId },
            include: { instance: true },
        });
        if (!row) return null;
        const decision = await this.authorization.check({
            subject: input.subject,
            target: { kind: 'stock-item', id: row.id },
            permissionCode: p.read,
            expectedScope: input.expectedScope,
        });
        if (!decision.allowed) return null;
        const material = await this.authorization.check({
            subject: input.subject,
            target: {
                kind: 'workspace',
                organizationId: row.organizationId,
                workspaceId: row.workspaceId,
            },
            permissionCode: materialPermission.read,
        });
        if (!material.allowed) return null;
        return {
            resourceId: input.resourceId,
            kind: this.instance ? ('MATERIAL_INSTANCE' as const) : ('STOCK_ITEM' as const),
            objectId: this.instance ? row.instanceId : row.id,
            scope: decision.context.scope,
            label: row.instance.code,
            href: `/main/inventory/detail/${row.id}?organization=${row.organizationId}&workspace=${row.workspaceId}`,
            archivedAt: row.instance.archivedAt,
        };
    }
}
@Injectable()
@ResourceExtension({ kind: 'STOCK_ITEM' })
export class StockResourceProvider extends StockResource {
    constructor(database: DatabaseRuntime, authorization: AuthorizationKernel) {
        super(database, authorization);
    }
}
@Injectable()
@ResourceExtension({ kind: 'MATERIAL_INSTANCE' })
export class InstanceResourceProvider extends StockResource {
    protected instance = true;
    constructor(database: DatabaseRuntime, authorization: AuthorizationKernel) {
        super(database, authorization);
    }
}
