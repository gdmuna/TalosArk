import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuid } from 'uuid';
import type { FileUploadSession, Prisma } from '@root/prisma/generated/client.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import {
    OrganizationContextError,
    OrganizationContextKernel,
} from '@/core/organization-context/index.js';
import type {
    BeginFileUpload,
    FileActor,
    FileAssetRequest,
    FileUploadRequest,
    FileUploadPart,
    FileAssetSnapshot,
} from '../file.contract.js';
import { FILE_OPTIONS, type ResolvedFileOptions } from '../file.options.js';
import { FileError } from '../file.error.js';
import { manifestSchema, parseFileInput } from './file.input.js';
import { FilePurposePolicy } from '../purpose/file-purpose.policy.js';

const assetInclude = { object: true } as const;
export type FileAssetRow = Prisma.FileAssetGetPayload<{ include: typeof assetInclude }>;

@Injectable()
export class FileRepository {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly organization: OrganizationContextKernel,
        private readonly purposes: FilePurposePolicy,
        @Inject(FILE_OPTIONS) private readonly options: ResolvedFileOptions
    ) {}

    private transaction<T>(work: () => Promise<T>): Promise<T> {
        return this.database.transaction.run(work, { isolationLevel: 'ReadCommitted' });
    }

    private async member(actor: FileActor) {
        try {
            return await this.organization.requireAccess(actor.userId, actor.organizationId);
        } catch (error) {
            if (OrganizationContextError.is(error, 'forbidden'))
                throw new FileError({ reason: 'unavailable' });
            throw error;
        }
    }

    async begin(input: BeginFileUpload): Promise<FileUploadSession> {
        return this.transaction(async () => {
            await this.member(input);
            if (input.purpose) {
                const purpose = await this.purposes.authorize(input, input.purpose, 'manage');
                this.purposes.admit(purpose.definition, input);
            }
            const id = uuid();
            await this.database.queryClient.fileUploadSession.createMany({
                skipDuplicates: true,
                data: {
                    id,
                    organizationId: input.organizationId,
                    uploadedById: input.userId,
                    idempotencyKey: input.idempotencyKey,
                    purposeKey: input.purpose?.purposeKey,
                    resourceId: input.purpose?.resourceId,
                    filename: input.filename,
                    contentType: input.contentType,
                    expectedSizeBytes: BigInt(input.sizeBytes),
                    expectedSha256: input.sha256,
                    mode: input.mode === 'single' ? 'SINGLE' : 'MULTIPART',
                    partSizeBytes: input.mode === 'multipart' ? this.options.partSizeBytes : null,
                    stagingBucket: this.options.stagingBucket,
                    stagingKey: `uploads/${input.organizationId}/${id}`,
                    expiresAt: new Date(Date.now() + this.options.uploadTtlSeconds * 1000),
                },
            });
            const session = await this.database.queryClient.fileUploadSession.findUniqueOrThrow({
                where: {
                    organizationId_uploadedById_idempotencyKey: {
                        organizationId: input.organizationId,
                        uploadedById: input.userId,
                        idempotencyKey: input.idempotencyKey,
                    },
                },
            });
            if (
                session.filename !== input.filename ||
                session.contentType !== input.contentType ||
                session.expectedSizeBytes !== BigInt(input.sizeBytes) ||
                session.expectedSha256 !== input.sha256 ||
                session.purposeKey !== (input.purpose?.purposeKey ?? null) ||
                session.resourceId !== (input.purpose?.resourceId ?? null) ||
                session.mode.toLowerCase() !== input.mode
            )
                throw new FileError({ reason: 'conflict' });
            return session;
        });
    }

    session(input: FileUploadRequest): Promise<FileUploadSession> {
        return this.transaction(async () => {
            const access = await this.member(input);
            const row = await this.database.queryClient.fileUploadSession.findFirst({
                where: {
                    id: input.sessionId,
                    organizationId: input.organizationId,
                    uploadedById: access.isSuperAdmin ? undefined : input.userId,
                },
            });
            if (!row) throw new FileError({ reason: 'unavailable' });
            await this.purposes.session(input, row);
            return row;
        });
    }

    async claim(input: FileUploadRequest, token: string): Promise<FileUploadSession> {
        return this.transaction(async () => {
            const access = await this.member(input);
            const now = new Date();
            const row = await this.database.queryClient.fileUploadSession.findFirst({
                where: {
                    id: input.sessionId,
                    organizationId: input.organizationId,
                    uploadedById: access.isSuperAdmin ? undefined : input.userId,
                },
            });
            if (!row) throw new FileError({ reason: 'unavailable' });
            if (row.status !== 'OPEN') throw new FileError({ reason: 'invalid-state' });
            if (row.expiresAt <= now) throw new FileError({ reason: 'expired' });
            await this.purposes.session(input, row);
            const claimed = await this.database.queryClient.fileUploadSession.updateMany({
                where: {
                    id: row.id,
                    status: 'OPEN',
                    expiresAt: { gt: now },
                    OR: [{ leaseToken: null }, { leaseUntil: { lte: now } }],
                },
                data: {
                    leaseToken: token,
                    leaseUntil: new Date(now.getTime() + this.options.operationTimeoutMs + 30_000),
                },
            });
            if (claimed.count !== 1) throw new FileError({ reason: 'busy' });
            return { ...row, leaseToken: token };
        });
    }

    async release(id: string, token: string): Promise<void> {
        await this.database.queryClient.fileUploadSession.updateMany({
            where: { id, leaseToken: token },
            data: { leaseToken: null, leaseUntil: null },
        });
    }

    async saveUploadId(id: string, token: string, uploadId: string): Promise<void> {
        const result = await this.database.queryClient.fileUploadSession.updateMany({
            where: { id, status: 'OPEN', leaseToken: token, leaseUntil: { gt: new Date() } },
            data: { multipartUploadId: uploadId },
        });
        if (result.count !== 1) throw new FileError({ reason: 'busy' });
    }

    async saveManifest(
        session: FileUploadSession,
        token: string,
        parts: readonly FileUploadPart[]
    ): Promise<void> {
        if (
            session.completionParts &&
            JSON.stringify(parseFileInput(manifestSchema, session.completionParts)) !==
                JSON.stringify(parts)
        )
            throw new FileError({ reason: 'conflict' });
        const result = await this.database.queryClient.fileUploadSession.updateMany({
            where: {
                id: session.id,
                status: 'OPEN',
                leaseToken: token,
                leaseUntil: { gt: new Date() },
            },
            data: { completionParts: parts.map((part) => ({ ...part })) },
        });
        if (result.count !== 1) throw new FileError({ reason: 'busy' });
    }

    async createCandidate(
        session: FileUploadSession,
        token: string
    ): Promise<{ bucket: string; key: string }> {
        return this.transaction(async () => {
            await this.lockSession(session.id);
            const current = await this.database.queryClient.fileUploadSession.findUniqueOrThrow({
                where: { id: session.id },
            });
            this.assertLease(current, token);
            const object = await this.database.queryClient.fileObject.create({
                data: {
                    id: token,
                    organizationId: session.organizationId,
                    uploadSessionId: session.id,
                    bucket: this.options.privateBucket,
                    key: `objects/${session.organizationId}/${token}`,
                    sizeBytes: session.expectedSizeBytes,
                    contentType: session.contentType,
                    sha256: session.expectedSha256,
                },
            });
            return { bucket: object.bucket, key: object.key };
        });
    }

    async publish(
        input: FileUploadRequest,
        token: string,
        signal: AbortSignal
    ): Promise<FileAssetRow> {
        return this.transaction(async () => {
            signal.throwIfAborted();
            const access = await this.member(input);
            const intent = await this.database.queryClient.fileUploadSession.findFirst({
                where: {
                    id: input.sessionId,
                    organizationId: input.organizationId,
                    uploadedById: access.isSuperAdmin ? undefined : input.userId,
                },
            });
            if (!intent) throw new FileError({ reason: 'unavailable' });
            await this.purposes.session(input, intent);
            await this.lockSession(input.sessionId);
            const session = await this.database.queryClient.fileUploadSession.findUniqueOrThrow({
                where: { id: input.sessionId },
            });
            this.assertLease(session, token);
            const ready = await this.database.queryClient.fileObject.updateMany({
                where: { id: token, uploadSessionId: session.id, status: 'PENDING' },
                data: { status: 'AVAILABLE', verifiedAt: new Date() },
            });
            if (ready.count !== 1) throw new FileError({ reason: 'invalid-state' });
            const asset = await this.database.queryClient.fileAsset.create({
                data: {
                    organizationId: session.organizationId,
                    objectId: token,
                    uploadedById: session.uploadedById,
                    filename: session.filename,
                    unboundExpiresAt: new Date(Date.now() + this.options.unboundTtlSeconds * 1000),
                },
                include: assetInclude,
            });
            await this.database.queryClient.fileUploadSession.update({
                where: { id: session.id },
                data: {
                    status: 'COMPLETED',
                    assetId: asset.id,
                    leaseToken: null,
                    leaseUntil: null,
                },
            });
            signal.throwIfAborted();
            return asset;
        });
    }

    asset(input: FileAssetRequest): Promise<FileAssetRow> {
        return this.transaction(async () => {
            const access = await this.member(input);
            const row = await this.database.queryClient.fileAsset.findFirst({
                where: {
                    id: input.assetId,
                    organizationId: input.organizationId,
                    uploadedById: access.isSuperAdmin ? undefined : input.userId,
                    deletedAt: null,
                    OR: [{ unboundExpiresAt: null }, { unboundExpiresAt: { gt: new Date() } }],
                    object: {
                        status: 'AVAILABLE',
                        verifiedAt: { not: null },
                        sha256: { not: null },
                    },
                    references: { none: {} },
                },
                include: assetInclude,
            });
            if (!row) throw new FileError({ reason: 'unavailable' });
            return row;
        });
    }

    completedAsset(input: FileUploadRequest & { assetId: string }): Promise<FileAssetRow> {
        return this.transaction(async () => {
            const access = await this.member(input);
            const row = await this.database.queryClient.fileAsset.findFirst({
                where: {
                    id: input.assetId,
                    organizationId: input.organizationId,
                    uploadedById: access.isSuperAdmin ? undefined : input.userId,
                    deletedAt: null,
                    completedUpload: { id: input.sessionId },
                    object: {
                        status: 'AVAILABLE',
                        verifiedAt: { not: null },
                        sha256: { not: null },
                    },
                },
                include: { ...assetInclude, references: true },
            });
            if (!row) throw new FileError({ reason: 'unavailable' });
            if (row.references.length) {
                const reference = row.references.find((item) => !item.removedAt);
                if (!reference) throw new FileError({ reason: 'unavailable' });
                await this.purposes.authorize(input, reference, 'read');
            } else if (!row.unboundExpiresAt || row.unboundExpiresAt <= new Date()) {
                throw new FileError({ reason: 'unavailable' });
            }
            return row;
        });
    }

    async cancel(input: FileUploadRequest): Promise<FileUploadSession> {
        return this.transaction(async () => {
            const access = await this.member(input);
            const intent = await this.database.queryClient.fileUploadSession.findFirst({
                where: {
                    id: input.sessionId,
                    organizationId: input.organizationId,
                    uploadedById: access.isSuperAdmin ? undefined : input.userId,
                },
            });
            if (!intent) throw new FileError({ reason: 'unavailable' });
            await this.purposes.session(input, intent);
            await this.lockSession(input.sessionId);
            const row = await this.database.queryClient.fileUploadSession.findFirst({
                where: {
                    id: input.sessionId,
                    organizationId: input.organizationId,
                    uploadedById: access.isSuperAdmin ? undefined : input.userId,
                },
            });
            if (!row) throw new FileError({ reason: 'unavailable' });
            if (row.status === 'COMPLETED') throw new FileError({ reason: 'invalid-state' });
            if (row.status !== 'OPEN') return row;
            return this.database.queryClient.fileUploadSession.update({
                where: { id: row.id },
                data: {
                    status: 'CANCELLED',
                    leaseToken: null,
                    leaseUntil: null,
                },
            });
        });
    }

    async remove(input: FileAssetRequest): Promise<void> {
        await this.transaction(async () => {
            const access = await this.member(input);
            const row = await this.database.queryClient.fileAsset.findFirst({
                where: {
                    id: input.assetId,
                    organizationId: input.organizationId,
                    uploadedById: access.isSuperAdmin ? undefined : input.userId,
                },
            });
            if (!row) throw new FileError({ reason: 'unavailable' });
            await this.retireAsset(row.id, row.objectId, false);
        });
    }

    async expire(limit: number): Promise<{ uploads: number; assets: number }> {
        const now = new Date();
        const uploads = await this.database.queryClient.fileUploadSession.updateMany({
            where: {
                status: 'OPEN',
                expiresAt: { lte: now },
                OR: [{ leaseToken: null }, { leaseUntil: { lte: now } }],
                id: {
                    in: (
                        await this.database.queryClient.fileUploadSession.findMany({
                            where: { status: 'OPEN', expiresAt: { lte: now } },
                            take: limit,
                            orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
                            select: { id: true },
                        })
                    ).map((row) => row.id),
                },
            },
            data: { status: 'EXPIRED', leaseToken: null, leaseUntil: null },
        });
        const candidates = await this.database.queryClient.fileAsset.findMany({
            where: {
                deletedAt: null,
                unboundExpiresAt: { lte: now },
                references: { none: { removedAt: null } },
            },
            orderBy: [{ unboundExpiresAt: 'asc' }, { id: 'asc' }],
            take: limit,
            select: { id: true, objectId: true },
        });
        let assets = 0;
        for (const candidate of candidates) {
            if (
                await this.transaction(() =>
                    this.retireAsset(candidate.id, candidate.objectId, true)
                )
            )
                assets++;
        }
        return { uploads: uploads.count, assets };
    }

    cleanupSessions(limit: number): Promise<FileUploadSession[]> {
        return this.database.queryClient.fileUploadSession.findMany({
            where: { status: { not: 'OPEN' } },
            take: limit,
            orderBy: [{ lastCleanupAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
        });
    }

    async touchSession(id: string): Promise<void> {
        await this.database.queryClient.fileUploadSession.update({
            where: { id },
            data: { lastCleanupAt: new Date() },
        });
    }

    cleanupObjects(limit: number) {
        return this.database.queryClient.fileObject.findMany({
            where: {
                OR: [{ status: 'DELETED' }, { status: 'PENDING', uploadSessionId: { not: null } }],
            },
            take: limit,
            orderBy: [{ lastCleanupAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
            select: { id: true },
        });
    }

    async retireObject(id: string): Promise<{ bucket: string; key: string } | null> {
        return this.transaction(async () => {
            await this.database.queryClient
                .$queryRaw`SELECT "id" FROM "FileObject" WHERE "id" = ${id}::uuid FOR UPDATE`;
            const object = await this.database.queryClient.fileObject.findUnique({
                where: { id },
                include: { uploadSession: true },
            });
            if (!object) return null;
            await this.database.queryClient.fileObject.update({
                where: { id },
                data: { lastCleanupAt: new Date() },
            });
            if (object.status === 'AVAILABLE') return null;
            const session = object.uploadSession;
            if (
                object.status === 'PENDING' &&
                (!session ||
                    (session.status === 'OPEN' &&
                        session.leaseToken === id &&
                        session.leaseUntil &&
                        session.leaseUntil > new Date()))
            )
                return null;
            if (
                await this.database.queryClient.fileAsset.count({
                    where: {
                        objectId: id,
                        OR: [{ deletedAt: null }, { references: { some: { removedAt: null } } }],
                    },
                })
            )
                return null;
            await this.database.queryClient.fileObject.update({
                where: { id },
                data: { status: 'DELETED', deletedAt: object.deletedAt ?? new Date() },
            });
            return { bucket: object.bucket, key: object.key };
        });
    }

    private async retireAsset(
        id: string,
        objectId: string,
        onlyExpired: boolean
    ): Promise<boolean> {
        await this.lockAsset(id, objectId);
        return this.retireLockedAsset(id, objectId, onlyExpired);
    }

    /** Requires FileObject -> FileAsset locks held by the current transaction. */
    async retireLockedAsset(id: string, objectId: string, onlyExpired: boolean): Promise<boolean> {
        const row = await this.database.queryClient.fileAsset.findUniqueOrThrow({
            where: { id },
            include: { references: { where: { removedAt: null }, select: { id: true } } },
        });
        if (row.references.length) {
            if (onlyExpired) return false;
            throw new FileError({ reason: 'in-use' });
        }
        if (
            row.deletedAt ||
            (onlyExpired && (!row.unboundExpiresAt || row.unboundExpiresAt > new Date()))
        )
            return false;
        await this.database.queryClient.fileAsset.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        if (
            !(await this.database.queryClient.fileAsset.count({
                where: { objectId, deletedAt: null },
            }))
        )
            await this.database.queryClient.fileObject.update({
                where: { id: objectId },
                data: { status: 'DELETED', deletedAt: new Date() },
            });
        return true;
    }

    async lockAsset(id: string, objectId: string): Promise<void> {
        await this.database.queryClient
            .$queryRaw`SELECT "id" FROM "FileObject" WHERE "id" = ${objectId}::uuid FOR UPDATE`;
        await this.database.queryClient
            .$queryRaw`SELECT "id" FROM "FileAsset" WHERE "id" = ${id}::uuid FOR UPDATE`;
    }

    private async lockSession(id: string): Promise<void> {
        await this.database.queryClient
            .$queryRaw`SELECT "id" FROM "FileUploadSession" WHERE "id" = ${id}::uuid FOR UPDATE`;
    }

    private assertLease(session: FileUploadSession, token: string): void {
        if (
            session.status !== 'OPEN' ||
            session.leaseToken !== token ||
            !session.leaseUntil ||
            session.leaseUntil <= new Date()
        )
            throw new FileError({ reason: 'busy' });
        if (session.expiresAt <= new Date()) throw new FileError({ reason: 'expired' });
    }
}

export function assetSnapshot(row: FileAssetRow): FileAssetSnapshot {
    if (!row.object.sha256) throw new FileError({ reason: 'unavailable' });
    return Object.freeze({
        id: row.id,
        organizationId: row.organizationId,
        uploadedById: row.uploadedById,
        filename: row.filename,
        contentType: row.object.contentType,
        sizeBytes: row.object.sizeBytes.toString(),
        sha256: row.object.sha256,
        createdAt: row.createdAt,
        unboundExpiresAt: row.unboundExpiresAt,
    });
}
