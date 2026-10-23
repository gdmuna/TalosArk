import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
    MaterialAttachmentBeginSchema,
    MaterialAttachmentCompleteSchema,
    MaterialAttachmentBindSchema,
} from '@talos-ark/contracts/material';
import type { z } from 'zod';
import { MaterialAttachmentService } from '../../../src/modules/material/application/material-attachment.service.js';
import { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import { attachmentKind } from './attachment.kind.js';
import type { BusinessSeeder } from '../seed.definition.js';
import type { SeedExecution } from '../seed.execution.js';

@Injectable()
export class AttachmentSeeder implements BusinessSeeder<typeof attachmentKind> {
    constructor(
        private readonly attachments: MaterialAttachmentService,
        private readonly database: DatabaseRuntime
    ) {}
    async seed(
        data: z.output<typeof attachmentKind.data>,
        input: z.output<typeof attachmentKind.input>,
        execution: SeedExecution
    ) {
        const material = Object.values(input.materials)[0];
        if (!material) throw new Error('Attachment fixtures require one active material');
        const params = {
            organizationId: input.scope.organizationId,
            workspaceId: input.scope.workspaceId,
            materialId: material.id,
        };
        const output: z.output<typeof attachmentKind.output> = {};
        for (const file of data.files) {
            if (Buffer.byteLength(file.text) * file.repeat > 32 * 1024 ** 2)
                throw new Error('Seed attachment payloads are limited to 32 MiB');
            output[file.key] = await execution.record({
                key: file.key,
                output: attachmentKind.output.valueType,
                transaction: 'business-managed',
                create: async () => {
                    const bytes = Buffer.from(file.text.repeat(file.repeat));
                    const sha256 = createHash('sha256').update(bytes).digest('hex');
                    const request = {
                        ...file.input,
                        idempotencyKey: randomUUID(),
                        sha256,
                        sizeBytes: bytes.length,
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
                        const length = session.partSizeBytes ?? bytes.length;
                        const response = await fetch(signed.url, {
                            method: signed.method,
                            headers: signed.headers,
                            body: bytes.subarray(
                                part * length,
                                Math.min((part + 1) * length, bytes.length)
                            ),
                            signal: AbortSignal.any([
                                execution.signal,
                                AbortSignal.timeout(120000),
                            ]),
                        });
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
                    const downloaded = Buffer.from(await response.arrayBuffer());
                    if (
                        downloaded.length !== bytes.length ||
                        createHash('sha256').update(downloaded).digest('hex') !== sha256
                    )
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
