import { Injectable } from '@nestjs/common';
import {
    ResourceExtension,
    type ResourceProvider,
    type ResourceLookup,
} from '@/core/resource/index.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { MaterialFactsReader } from '../public/material-facts.reader.js';
import { materialPermission } from '../contribution/material-authorization.contribution.js';

@Injectable()
@ResourceExtension({ kind: 'MATERIAL' })
export class MaterialResourceProvider implements ResourceProvider {
    constructor(
        private readonly facts: MaterialFactsReader,
        private readonly authorization: AuthorizationKernel
    ) {}
    async describe(input: ResourceLookup) {
        const material = await this.facts.byResourceId(input.resourceId);
        if (!material) return null;
        const decision = await this.authorization.check({
            subject: input.subject,
            permissionCode: materialPermission.read,
            target: { kind: 'material', id: material.id },
            expectedScope: input.expectedScope,
        });
        if (!decision.allowed) return null;
        return {
            resourceId: input.resourceId,
            kind: 'MATERIAL' as const,
            objectId: material.id,
            scope: decision.context.scope,
            label: material.name,
            href: `/main/material/detail/${material.id}`,
            archivedAt: material.archivedAt,
        };
    }
}
