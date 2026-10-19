import { Injectable } from '@nestjs/common';
import { MaterialAttachmentError } from './material-attachment.error.js';
import { materialAttachmentErrors } from './material-attachment.error.mapper.js';
import { FileKernel, type FileUploadRequest, type FileUploadSnapshot } from '@/core/file/index.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { MaterialFactsReader } from '../public/material-facts.reader.js';
import type {
    MaterialAttachmentBegin,
    MaterialAttachmentBind,
    MaterialAttachmentComplete,
    MaterialAttachmentDownload,
    MaterialAttachmentPage,
    MaterialAttachmentParams,
    MaterialAttachmentProgress,
    MaterialAttachmentQuery,
    MaterialAttachmentReference,
    MaterialAttachmentReferenceParams,
    MaterialAttachmentSign,
    MaterialAttachmentUpload,
    MaterialAttachmentUploadParams,
} from '@talos-ark/contracts/material';

const purposeKey = 'material.attachment';

@Injectable()
export class MaterialAttachmentService {
    constructor(
        private readonly files: FileKernel,
        private readonly facts: MaterialFactsReader,
        private readonly actor: AlsContextAdapter
    ) {}

    async begin(
        params: MaterialAttachmentParams,
        body: MaterialAttachmentBegin
    ): Promise<MaterialAttachmentUpload> {
        return materialAttachmentErrors.run(async () => {
            const resourceId = await this.resource(params);
            const actor = this.actor.requireActor();
            return this.uploadView(
                await this.files.beginUpload({
                    organizationId: params.organizationId,
                    userId: actor.userId,
                    purpose: { purposeKey, resourceId },
                    ...body,
                })
            );
        });
    }

    async sign(params: MaterialAttachmentUploadParams, body: MaterialAttachmentSign) {
        return materialAttachmentErrors.run(async () => {
            const request = await this.uploadRequest(params);
            return this.requestView(
                await this.files.signUpload({
                    ...request,
                    partNumber: body.partNumber,
                })
            );
        });
    }

    async progress(params: MaterialAttachmentUploadParams): Promise<MaterialAttachmentProgress> {
        return materialAttachmentErrors.run(async () => {
            const request = await this.uploadRequest(params);
            const progress = await this.files.inspectUpload(request);
            return {
                session: this.uploadView(progress.session),
                parts: progress.parts.map((part) => ({ ...part })),
            };
        });
    }

    async complete(
        params: MaterialAttachmentUploadParams,
        body: MaterialAttachmentComplete
    ): Promise<MaterialAttachmentUpload> {
        return materialAttachmentErrors.run(async () => {
            const request = await this.uploadRequest(params);
            await this.files.completeUpload({ ...request, parts: body.parts });
            return this.uploadView((await this.files.inspectUpload(request)).session);
        });
    }

    async cancel(params: MaterialAttachmentUploadParams): Promise<MaterialAttachmentUpload> {
        return materialAttachmentErrors.run(async () => {
            const request = await this.uploadRequest(params);
            return this.uploadView(await this.files.cancelUpload(request));
        });
    }

    async bind(
        params: MaterialAttachmentParams,
        body: MaterialAttachmentBind
    ): Promise<MaterialAttachmentReference> {
        return materialAttachmentErrors.run(async () => {
            const resourceId = await this.resource(params);
            const actor = this.actor.requireActor();
            return this.referenceView(
                await this.files.bind({
                    organizationId: params.organizationId,
                    userId: actor.userId,
                    resourceId,
                    purposeKey,
                    assetId: body.assetId,
                })
            );
        });
    }

    async list(
        params: MaterialAttachmentParams,
        query: MaterialAttachmentQuery
    ): Promise<MaterialAttachmentPage> {
        return materialAttachmentErrors.run(async () => {
            const resourceId = await this.resource(params);
            const actor = this.actor.requireActor();
            const page = await this.files.listReferences({
                organizationId: params.organizationId,
                userId: actor.userId,
                resourceId,
                purposeKey,
                ...query,
            });
            return {
                items: page.items.map((item) => this.referenceView(item)),
                nextCursor: page.nextCursor,
            };
        });
    }

    async download(params: MaterialAttachmentReferenceParams): Promise<MaterialAttachmentDownload> {
        return materialAttachmentErrors.run(async () => {
            const resourceId = await this.resource(params);
            const actor = this.actor.requireActor();
            const result = await this.files.downloadReference({
                organizationId: params.organizationId,
                userId: actor.userId,
                resourceId,
                purposeKey,
                referenceId: params.referenceId,
            });
            return {
                attachment: this.referenceView(result.reference),
                request: this.requestView(result.request),
            };
        });
    }

    async unbind(params: MaterialAttachmentReferenceParams): Promise<MaterialAttachmentReference> {
        return materialAttachmentErrors.run(async () => {
            const resourceId = await this.resource(params);
            const actor = this.actor.requireActor();
            return this.referenceView(
                await this.files.unbind({
                    organizationId: params.organizationId,
                    userId: actor.userId,
                    resourceId,
                    purposeKey,
                    referenceId: params.referenceId,
                })
            );
        });
    }

    private async resource(params: MaterialAttachmentParams): Promise<string> {
        const material = await this.facts.byId(params.materialId);
        if (
            !material ||
            material.organizationId !== params.organizationId ||
            material.workspaceId !== params.workspaceId
        )
            throw new MaterialAttachmentError({ reason: 'unavailable' });
        return material.resourceId;
    }

    private async uploadRequest(
        params: MaterialAttachmentUploadParams
    ): Promise<FileUploadRequest> {
        const resourceId = await this.resource(params);
        const actor = this.actor.requireActor();
        return {
            organizationId: params.organizationId,
            userId: actor.userId,
            sessionId: params.sessionId,
            expectedPurpose: { purposeKey, resourceId },
        };
    }

    private uploadView(snapshot: FileUploadSnapshot): MaterialAttachmentUpload {
        return {
            id: snapshot.id,
            status: snapshot.status,
            mode: snapshot.mode,
            filename: snapshot.filename,
            contentType: snapshot.contentType,
            sizeBytes: snapshot.sizeBytes,
            expiresAt: snapshot.expiresAt.toISOString(),
            assetId: snapshot.assetId,
            partSizeBytes: snapshot.partSizeBytes,
            partCount: snapshot.partCount,
            completionParts: snapshot.completionParts?.map((part) => ({ ...part })) ?? null,
        };
    }

    private requestView(request: {
        url: string;
        method: 'GET' | 'PUT';
        headers: Readonly<Record<string, string>>;
        expiresAt: Date;
    }) {
        return {
            url: request.url,
            method: request.method,
            headers: request.headers,
            expiresAt: request.expiresAt.toISOString(),
        };
    }

    private referenceView(reference: {
        id: string;
        removedAt: Date | null;
        asset: { filename: string; contentType: string; sizeBytes: string; createdAt: Date };
    }): MaterialAttachmentReference {
        return {
            id: reference.id,
            filename: reference.asset.filename,
            contentType: reference.asset.contentType,
            sizeBytes: reference.asset.sizeBytes,
            createdAt: reference.asset.createdAt.toISOString(),
            removedAt: reference.removedAt?.toISOString() ?? null,
        };
    }
}
