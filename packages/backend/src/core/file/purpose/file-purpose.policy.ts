import { Injectable } from '@nestjs/common';
import { extname } from 'node:path';
import type { FileUploadSession } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { parseResourceDescriptor } from '@/core/resource/index.js';
import type { FileActor, FilePurposeTarget, FileUploadRequest } from '../file.contract.js';
import { FileError } from '../file.error.js';
import { FilePurposeRegistry } from './file-purpose.registry.js';
import type { FilePurposeDefinition } from './file-purpose.definition.js';

@Injectable()
export class FilePurposePolicy {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly registry: FilePurposeRegistry
    ) {}

    async authorize(actor: FileActor, target: FilePurposeTarget, mode: 'read' | 'manage') {
        const purpose = this.registry.require(target.purposeKey);
        const identity = await this.database.queryClient.resourceIdentity.findFirst({
            where: {
                id: target.resourceId,
                organizationId: actor.organizationId,
                kind: purpose.definition.resourceKind,
            },
            select: { id: true },
        });
        if (!identity) throw new FileError({ reason: 'unavailable' });
        const result = await purpose.provider.authorize({
            actor,
            resourceId: target.resourceId,
            mode,
        });
        if (!result) throw new FileError({ reason: 'unavailable' });
        const resource = parseResourceDescriptor(result);
        if (
            resource.resourceId !== target.resourceId ||
            resource.kind !== purpose.definition.resourceKind ||
            resource.scope.organizationId !== actor.organizationId
        )
            throw new FileError({ reason: 'invalid-purpose' });
        if (mode === 'manage' && resource.archivedAt)
            throw new FileError({ reason: 'resource-readonly' });
        return {
            ...purpose,
            resource: Object.freeze({ ...resource, scope: Object.freeze(resource.scope) }),
        };
    }

    admit(
        definition: FilePurposeDefinition,
        file: { filename: string; contentType: string; sizeBytes: bigint | number }
    ): void {
        if (BigInt(file.sizeBytes) > BigInt(definition.maxSizeBytes))
            throw new FileError({ reason: 'size-not-allowed' });
        const extension = extname(file.filename).slice(1).toLowerCase();
        if (
            !Object.hasOwn(definition.formats, extension) ||
            !definition.formats[extension].includes(file.contentType)
        )
            throw new FileError({ reason: 'format-not-allowed' });
    }

    async session(input: FileUploadRequest, session: FileUploadSession): Promise<void> {
        if (
            input.expectedPurpose &&
            (session.purposeKey !== input.expectedPurpose.purposeKey ||
                session.resourceId?.toLowerCase() !==
                    input.expectedPurpose.resourceId.toLowerCase())
        )
            throw new FileError({ reason: 'unavailable' });
        if (session.purposeKey === null && session.resourceId === null) return;
        if (!session.purposeKey || !session.resourceId)
            throw new FileError({ reason: 'invalid-state' });
        const purpose = await this.authorize(
            input,
            {
                purposeKey: session.purposeKey,
                resourceId: session.resourceId,
            },
            session.status === 'COMPLETED' ? 'read' : 'manage'
        );
        this.admit(purpose.definition, {
            filename: session.filename,
            contentType: session.contentType,
            sizeBytes: session.expectedSizeBytes,
        });
    }
}
