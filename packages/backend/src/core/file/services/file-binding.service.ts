import { Injectable } from '@nestjs/common';
import type { Prisma } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { SystemAccessKernel } from '@/core/system-access/index.js';
import { FileRepository, assetSnapshot } from '../internal/file.repository.js';
import { FilePurposePolicy } from '../purpose/file-purpose.policy.js';
import {
    bindingSchema,
    referenceSchema,
    referenceQuerySchema,
    parseFileInput,
} from '../internal/file.input.js';
import { readReferenceCursor, writeReferenceCursor } from '../internal/file-reference.cursor.js';
import { FileError } from '../file.error.js';
import type {
    BindFileAsset,
    FileActor,
    FilePurposeTarget,
    FileReferenceRequest,
    FileReferenceQuery,
    FileReferenceSnapshot,
    FileReferencePage,
} from '../file.contract.js';

const include = { asset: { include: { object: true } } } as const;
type ReferenceRow = Prisma.FileReferenceGetPayload<{ include: typeof include }>;

export function referenceSnapshot(row: ReferenceRow): FileReferenceSnapshot {
    return Object.freeze({
        id: row.id,
        resourceId: row.resourceId,
        purposeKey: row.purposeKey,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        removedAt: row.removedAt,
        asset: assetSnapshot(row.asset),
    });
}

function referenceWhere(input: FileActor & FilePurposeTarget): Prisma.FileReferenceWhereInput {
    return {
        organizationId: input.organizationId,
        resourceId: input.resourceId,
        purposeKey: input.purposeKey,
    };
}

const availableAsset = {
    deletedAt: null,
    object: { status: 'AVAILABLE', verifiedAt: { not: null }, sha256: { not: null } },
} satisfies Prisma.FileAssetWhereInput;

@Injectable()
export class FileBindingService {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly files: FileRepository,
        private readonly purposes: FilePurposePolicy,
        private readonly systemAccess: SystemAccessKernel
    ) {}

    bind(input: BindFileAsset): Promise<FileReferenceSnapshot> {
        return this.transaction('write', async () => {
            const value = parseFileInput(bindingSchema, input);
            const purpose = await this.purposes.authorize(value, value, 'manage');
            const candidate = await this.database.queryClient.fileAsset.findFirst({
                where: { id: value.assetId, organizationId: value.organizationId },
                select: { id: true, objectId: true },
            });
            if (!candidate) throw new FileError({ reason: 'unavailable' });
            await this.files.lockAsset(candidate.id, candidate.objectId);
            const asset = await this.database.queryClient.fileAsset.findFirst({
                where: {
                    id: candidate.id,
                    organizationId: value.organizationId,
                    ...availableAsset,
                },
                include: { object: true, references: true, completedUpload: true },
            });
            if (!asset) throw new FileError({ reason: 'unavailable' });
            const existing = asset.references.find(
                (reference) =>
                    reference.resourceId === value.resourceId &&
                    reference.purposeKey === value.purposeKey
            );
            if (existing && !existing.removedAt) return referenceSnapshot({ ...existing, asset });
            if (asset.references.length) throw new FileError({ reason: 'in-use' });
            if (
                (asset.uploadedById !== value.userId &&
                    !(await this.systemAccess.isSuperAdmin(value.userId))) ||
                !asset.unboundExpiresAt ||
                asset.unboundExpiresAt <= new Date()
            )
                throw new FileError({ reason: 'unavailable' });
            const intent = asset.completedUpload;
            if (
                !intent ||
                intent.status !== 'COMPLETED' ||
                ((intent.purposeKey !== null || intent.resourceId !== null) &&
                    (intent.purposeKey !== value.purposeKey ||
                        intent.resourceId !== value.resourceId))
            )
                throw new FileError({ reason: 'unavailable' });
            this.purposes.admit(purpose.definition, {
                filename: asset.filename,
                contentType: asset.object.contentType,
                sizeBytes: asset.object.sizeBytes,
            });
            const row = await this.database.queryClient.fileReference.create({
                data: {
                    organizationId: value.organizationId,
                    resourceId: value.resourceId,
                    purposeKey: value.purposeKey,
                    assetId: asset.id,
                },
                include,
            });
            await this.database.queryClient.fileAsset.update({
                where: { id: asset.id },
                data: { unboundExpiresAt: null },
            });
            const reference = referenceSnapshot({
                ...row,
                asset: { ...row.asset, unboundExpiresAt: null },
            });
            await purpose.provider.recordChange({
                actor: { organizationId: value.organizationId, userId: value.userId },
                resource: purpose.resource,
                reference,
                action: 'bind',
            });
            return reference;
        });
    }

    unbind(input: FileReferenceRequest): Promise<FileReferenceSnapshot> {
        return this.transaction('write', async () => {
            const value = parseFileInput(referenceSchema, input);
            const purpose = await this.purposes.authorize(value, value, 'manage');
            const candidate = await this.database.queryClient.fileReference.findFirst({
                where: { ...referenceWhere(value), id: value.referenceId },
                include: { asset: { select: { objectId: true } } },
            });
            if (!candidate) throw new FileError({ reason: 'unavailable' });
            await this.files.lockAsset(candidate.assetId, candidate.asset.objectId);
            const row = await this.database.queryClient.fileReference.findFirst({
                where: { ...referenceWhere(value), id: value.referenceId },
                include,
            });
            if (!row) throw new FileError({ reason: 'unavailable' });
            if (row.removedAt) return referenceSnapshot(row);
            const removed = await this.database.queryClient.fileReference.update({
                where: { id: row.id },
                data: { removedAt: new Date() },
                include,
            });
            await this.files.retireLockedAsset(row.assetId, row.asset.objectId, false);
            const reference = referenceSnapshot(removed);
            await purpose.provider.recordChange({
                actor: { organizationId: value.organizationId, userId: value.userId },
                resource: purpose.resource,
                reference,
                action: 'unbind',
            });
            return reference;
        });
    }

    list(input: FileReferenceQuery): Promise<FileReferencePage> {
        return this.transaction('read', async () => {
            const value = parseFileInput(referenceQuerySchema, input);
            await this.purposes.authorize(value, value, 'read');
            const cursor = readReferenceCursor(value);
            const rows = await this.database.queryClient.fileReference.findMany({
                where: {
                    ...referenceWhere(value),
                    removedAt: null,
                    asset: availableAsset,
                    ...(cursor
                        ? {
                              OR: [
                                  { sortOrder: { gt: cursor.sortOrder } },
                                  { sortOrder: cursor.sortOrder, id: { gt: cursor.id } },
                              ],
                          }
                        : {}),
                },
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                take: value.limit + 1,
                include,
            });
            const items = rows.slice(0, value.limit).map(referenceSnapshot);
            return Object.freeze({
                items: Object.freeze(items),
                nextCursor:
                    rows.length > value.limit
                        ? writeReferenceCursor(value, items[items.length - 1])
                        : null,
            });
        });
    }

    read(input: FileReferenceRequest): Promise<ReferenceRow> {
        return this.transaction('read', async () => {
            const value = parseFileInput(referenceSchema, input);
            await this.purposes.authorize(value, value, 'read');
            const row = await this.database.queryClient.fileReference.findFirst({
                where: {
                    ...referenceWhere(value),
                    id: value.referenceId,
                    removedAt: null,
                    asset: availableAsset,
                },
                include,
            });
            if (!row) throw new FileError({ reason: 'unavailable' });
            return row;
        });
    }

    private transaction<T>(mode: 'read' | 'write', work: () => Promise<T>): Promise<T> {
        return this.database.transaction.run(
            work,
            mode === 'write'
                ? {
                      propagation: this.database.transaction.current() ? 'mandatory' : 'required',
                      isolationLevel: 'ReadCommitted',
                  }
                : this.database.transaction.current()
                  ? { propagation: 'mandatory' }
                  : { isolationLevel: 'RepeatableRead' }
        );
    }
}
