import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
    MaterialAttachmentBeginSchema,
    MaterialAttachmentCompleteSchema,
    MaterialAttachmentBindSchema,
} from '@talos-ark/contracts/material';
import type { z } from 'zod';
import { MaterialAttachmentService } from '../../../../src/modules/material/application/material-attachment.service.js';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { attachmentKind } from './attachment.kind.js';
import { type BusinessSeeder } from '../../runtime/handler.js';
import type { SeedExecution } from '../../runtime/execution.js';
import { PreparedFixtures } from '../../fixture/fixture.reader.js';

@Injectable()
export class AttachmentSeeder implements BusinessSeeder<typeof attachmentKind> {
    constructor(
        private readonly attachments: MaterialAttachmentService,
        private readonly database: DatabaseRuntime,
        private readonly fixtures: PreparedFixtures
    ) {}
    async seed(
        data: z.output<typeof attachmentKind.data>,
        input: z.output<typeof attachmentKind.input>,
        execution: SeedExecution
    ) {
        const output: z.output<typeof attachmentKind.output> = {};
        for (const file of data.files) {
            const material = input.materials[file.materialKey];
            if (!material) throw new Error(`Unknown attachment material: ${file.materialKey}`);
            const params = {
                organizationId: input.scope.organizationId,
                workspaceId: input.scope.workspaceId,
                materialId: material.id,
            };
            if (
                file.source.kind === 'generated' &&
                Buffer.byteLength(file.source.text) * file.source.repeat > 32 * 1024 ** 2
            )
                throw new Error('Seed attachment payloads are limited to 32 MiB');
            output[file.key] = await execution.record({
                key: file.key,
                output: attachmentKind.output.valueType,
                transaction: 'business-managed',
                create: async () => {
                    const content =
                        file.source.kind === 'generated'
                            ? Buffer.from(file.source.text.repeat(file.source.repeat))
                            : this.fixtures.get(file.source.id);
                    const sizeBytes = Buffer.isBuffer(content) ? content.length : content.sizeBytes;
                    const sha256 = Buffer.isBuffer(content)
                        ? createHash('sha256').update(content).digest('hex')
                        : content.sha256;
                    const request = {
                        ...file.input,
                        idempotencyKey: randomUUID(),
                        sha256,
                        sizeBytes,
                    } satisfies z.input<typeof MaterialAttachmentBeginSchema>;
                    const session = await this.attachments.begin(
                        params,
                        MaterialAttachmentBeginSchema.parse(request)
                    );
                    const uploadParams = { ...params, sessionId: session.id };
                    const parts: NonNullable<
                        z.input<typeof MaterialAttachmentCompleteSchema>['parts']
                    > = [];
                    for (let part = 0; part < session.partCount; part++) {
                        execution.signal.throwIfAborted();
                        const signed = await this.attachments.sign(
                            uploadParams,
                            session.mode === 'multipart' ? { partNumber: part + 1 } : {}
                        );
                        const length = session.partSizeBytes ?? sizeBytes;
                        const start = part * length;
                        const partLength = Math.min(length, sizeBytes - start);
                        const body = Buffer.isBuffer(content)
                            ? content.subarray(start, start + partLength)
                            : this.fixtures.body(content.id, start, partLength);
                        const request = {
                            method: signed.method,
                            // S3-compatible endpoints need a known length for streamed PUTs.
                            headers: { ...signed.headers, 'content-length': String(partLength) },
                            body,
                            ...(!Buffer.isBuffer(content) ? { duplex: 'half' as const } : {}),
                            signal: AbortSignal.any([
                                execution.signal,
                                AbortSignal.timeout(120000),
                            ]),
                        };
                        const response = await fetch(signed.url, request);
                        const etag = response.headers.get('etag');
                        await response.body?.cancel();
                        if (!response.ok)
                            throw new Error(
                                `Seed object upload failed with HTTP ${response.status}; signed URLs are not logged`
                            );
                        if (session.mode === 'multipart') {
                            if (!etag) throw new Error('Multipart upload did not return an ETag');
                            parts.push({ partNumber: part + 1, etag });
                        }
                    }
                    const complete = {
                        ...(session.mode === 'multipart' ? { parts } : {}),
                    } satisfies z.input<typeof MaterialAttachmentCompleteSchema>;
                    const uploaded = await this.attachments.complete(
                        uploadParams,
                        MaterialAttachmentCompleteSchema.parse(complete)
                    );
                    if (!uploaded.assetId)
                        throw new Error('Completed upload did not publish an asset');
                    const bind = { assetId: uploaded.assetId } satisfies z.input<
                        typeof MaterialAttachmentBindSchema
                    >;
                    const reference = await this.attachments.bind(
                        params,
                        MaterialAttachmentBindSchema.parse(bind)
                    );
                    const download = await this.attachments.download({
                        ...params,
                        referenceId: reference.id,
                    });
                    const response = await fetch(download.request.url, {
                        headers: download.request.headers,
                        signal: AbortSignal.any([execution.signal, AbortSignal.timeout(120000)]),
                    });
                    if (!response.ok) {
                        await response.body?.cancel();
                        throw new Error(`Seed object download failed with HTTP ${response.status}`);
                    }
                    if (!response.body) throw new Error('Seed download did not include a body');
                    const downloaded = response.body.getReader();
                    const downloadHash = createHash('sha256');
                    let downloadedSize = 0;
                    try {
                        for (;;) {
                            const chunk = await downloaded.read();
                            if (chunk.done) break;
                            downloadedSize += chunk.value.byteLength;
                            if (downloadedSize > sizeBytes)
                                throw new Error('Seed download exceeds the expected size');
                            downloadHash.update(chunk.value);
                        }
                    } finally {
                        await downloaded.cancel().catch(() => {});
                        downloaded.releaseLock();
                    }
                    if (downloadedSize !== sizeBytes || downloadHash.digest('hex') !== sha256)
                        throw new Error(
                            'Seed attachment download did not match the uploaded bytes'
                        );
                    if (file.unbind)
                        await this.attachments.unbind({ ...params, referenceId: reference.id });
                    return {
                        sessionId: session.id,
                        assetId: uploaded.assetId,
                        referenceId: reference.id,
                    };
                },
                inspect: async ({ sessionId, assetId, referenceId }) => {
                    const reference =
                        await this.database.queryClient.fileReference.findUniqueOrThrow({
                            where: { id: referenceId },
                            include: { asset: { include: { object: true } } },
                        });
                    const session =
                        await this.database.queryClient.fileUploadSession.findUniqueOrThrow({
                            where: { id: sessionId },
                            select: {
                                id: true,
                                status: true,
                                mode: true,
                                assetId: true,
                                resourceId: true,
                                purposeKey: true,
                                expectedSizeBytes: true,
                                expectedSha256: true,
                            },
                        });
                    if (
                        reference.assetId !== assetId ||
                        session.assetId !== assetId ||
                        !!reference.removedAt !== file.unbind
                    )
                        throw new Error('Attachment fixture references no longer match');
                    return { reference, session };
                },
            });
        }
        return output;
    }
}
