import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AuthorizationKernel } from '@/core/authorization/index.js';
import { AuditKernel } from '@/core/audit/index.js';
import {
    FilePurposeExtension,
    type FilePurposeProvider,
    type FilePurposeAccess,
    type FilePurposeChange,
} from '@/core/file/index.js';
import { MaterialFactsReader } from '../public/material-facts.reader.js';
import { materialPermission } from '../contribution/material-authorization.contribution.js';
import { materialAttachmentPurpose } from './material-file-purpose.definition.js';

@Injectable()
@FilePurposeExtension(materialAttachmentPurpose)
export class MaterialFilePurposeProvider implements FilePurposeProvider {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly facts: MaterialFactsReader,
        private readonly authorization: AuthorizationKernel,
        private readonly audit: AuditKernel
    ) {}

    async authorize(input: FilePurposeAccess) {
        if (input.mode === 'manage') {
            const organizations = await this.database.queryClient.$queryRaw<{ id: string }[]>`
                SELECT "id" FROM public."Organization"
                WHERE "id" = ${input.actor.organizationId}::uuid AND "archivedAt" IS NULL FOR UPDATE`;
            if (!organizations.length) return null;
            await this.database.queryClient.$queryRaw`
                SELECT "id" FROM public."Material"
                WHERE "organizationId" = ${input.actor.organizationId}::uuid
                AND "resourceId" = ${input.resourceId}::uuid FOR UPDATE`;
        }
        const material = await this.facts.byResourceId(input.resourceId);
        if (!material || material.organizationId !== input.actor.organizationId) return null;
        const decision = await this.authorization.check({
            subject: { kind: 'user', userId: input.actor.userId },
            permissionCode:
                input.mode === 'read' ? materialPermission.read : materialPermission.update,
            target: { kind: 'material', id: material.id },
            expectedScope: {
                kind: 'workspace',
                organizationId: material.organizationId,
                workspaceId: material.workspaceId,
            },
        });
        if (!decision.allowed) return null;
        return {
            resourceId: material.resourceId,
            kind: 'MATERIAL' as const,
            objectId: material.id,
            scope: decision.context.scope,
            label: material.name,
            href: `/main/material/detail/${material.id}`,
            archivedAt: material.archivedAt,
        };
    }

    async recordChange(input: FilePurposeChange): Promise<void> {
        await this.audit.record({
            organizationId: input.actor.organizationId,
            workspaceId:
                input.resource.scope.kind === 'workspace'
                    ? input.resource.scope.workspaceId
                    : undefined,
            actorUserId: input.actor.userId,
            action: `material.attachment.${input.action}`,
            occurredAt: new Date(),
            details: {
                materialId: input.resource.objectId,
                referenceId: input.reference.id,
                assetId: input.reference.asset.id,
                purposeKey: input.reference.purposeKey,
            },
            resources: [
                { resourceId: input.resource.resourceId, labelSnapshot: input.resource.label },
            ],
        });
    }
}
