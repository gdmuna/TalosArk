import type {
    Material,
    MaterialScope,
    MaterialQuery,
    MaterialPage,
    MaterialOverview,
    MaterialDetail,
    MaterialTypeList,
    MaterialType,
    MaterialTypeWrite,
    MaterialWrite,
    MaterialAttachmentBegin,
    MaterialAttachmentComplete,
    MaterialAttachmentQuery,
    MaterialAttachmentPage,
    MaterialAttachmentUpload,
    MaterialAttachmentProgress,
    MaterialAttachmentPresignedRequest,
    MaterialAttachmentReference,
    MaterialAttachmentDownload,
} from '@talos-ark/contracts/material';
import type { z } from 'zod';
import {
    BatchArchiveSchema,
    BatchPageSchema,
    BatchQuerySchema,
    BatchSchema,
    BatchUpdateSchema,
    BatchWriteSchema,
} from '@talos-ark/contracts/material';

export type MaterialBatch = z.infer<typeof BatchSchema>;
export type MaterialBatchPage = z.infer<typeof BatchPageSchema>;
export type MaterialBatchQuery = z.infer<typeof BatchQuerySchema>;
export type MaterialBatchWrite = z.infer<typeof BatchWriteSchema>;
export type MaterialBatchUpdate = z.infer<typeof BatchUpdateSchema>;
export type MaterialBatchArchive = z.infer<typeof BatchArchiveSchema>;

export interface MaterialAttachmentDataSource {
    list(
        scope: MaterialScope,
        materialId: string,
        query: MaterialAttachmentQuery,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentPage>;
    begin(
        scope: MaterialScope,
        materialId: string,
        body: MaterialAttachmentBegin,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentUpload>;
    sign(
        scope: MaterialScope,
        materialId: string,
        sessionId: string,
        partNumber?: number,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentPresignedRequest>;
    progress(
        scope: MaterialScope,
        materialId: string,
        sessionId: string,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentProgress>;
    complete(
        scope: MaterialScope,
        materialId: string,
        sessionId: string,
        body: MaterialAttachmentComplete,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentUpload>;
    cancel(
        scope: MaterialScope,
        materialId: string,
        sessionId: string,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentUpload>;
    bind(
        scope: MaterialScope,
        materialId: string,
        assetId: string,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentReference>;
    download(
        scope: MaterialScope,
        materialId: string,
        referenceId: string,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentDownload>;
    unbind(
        scope: MaterialScope,
        materialId: string,
        referenceId: string,
        signal?: AbortSignal
    ): Promise<MaterialAttachmentReference>;
}

export interface MaterialDataSource {
    attachments: MaterialAttachmentDataSource;
    list(scope: MaterialScope, query: MaterialQuery, signal?: AbortSignal): Promise<MaterialPage>;
    overview(scope: MaterialScope, signal?: AbortSignal): Promise<MaterialOverview>;
    get(scope: MaterialScope, id: string, signal?: AbortSignal): Promise<MaterialDetail>;
    types(scope: MaterialScope, signal?: AbortSignal): Promise<MaterialTypeList>;
    create(scope: MaterialScope, input: MaterialWrite, signal?: AbortSignal): Promise<Material>;
    update(
        scope: MaterialScope,
        id: string,
        input: MaterialWrite,
        signal?: AbortSignal
    ): Promise<Material>;
    archive(
        scope: MaterialScope,
        id: string,
        archived: boolean,
        signal?: AbortSignal
    ): Promise<Material>;
    createType(
        scope: MaterialScope,
        input: MaterialTypeWrite,
        signal?: AbortSignal
    ): Promise<MaterialType>;
    updateType(
        scope: MaterialScope,
        id: string,
        input: MaterialTypeWrite,
        signal?: AbortSignal
    ): Promise<MaterialType>;
    archiveType(
        scope: MaterialScope,
        id: string,
        archived: boolean,
        signal?: AbortSignal
    ): Promise<MaterialType>;
    listBatches(
        scope: MaterialScope,
        materialId: string,
        query: MaterialBatchQuery,
        signal?: AbortSignal
    ): Promise<MaterialBatchPage>;
    getBatch(
        scope: MaterialScope,
        materialId: string,
        batchId: string,
        signal?: AbortSignal
    ): Promise<MaterialBatch>;
    createBatch(
        scope: MaterialScope,
        materialId: string,
        input: MaterialBatchWrite,
        signal?: AbortSignal
    ): Promise<MaterialBatch>;
    updateBatch(
        scope: MaterialScope,
        materialId: string,
        batchId: string,
        input: MaterialBatchUpdate,
        signal?: AbortSignal
    ): Promise<MaterialBatch>;
    archiveBatch(
        scope: MaterialScope,
        materialId: string,
        batchId: string,
        input: MaterialBatchArchive,
        signal?: AbortSignal
    ): Promise<MaterialBatch>;
}
