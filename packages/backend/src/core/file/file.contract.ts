import type { PresignedRequest } from '@/infra/storage/index.js';

export interface FileActor {
    readonly organizationId: string;
    readonly userId: string;
}

export interface BeginFileUpload extends FileActor {
    readonly purpose?: FilePurposeTarget;
    readonly idempotencyKey: string;
    readonly filename: string;
    /** A declaration, not a detected or security-verified media type. */
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly sha256: string;
    readonly mode: 'single' | 'multipart';
}

export interface FileUploadRequest extends FileActor {
    readonly sessionId: string;
    readonly expectedPurpose?: FilePurposeTarget;
}

export interface FilePartRequest extends FileUploadRequest {
    readonly partNumber?: number;
}

export interface FileUploadPart {
    readonly partNumber: number;
    readonly etag: string;
}

export interface CompleteFileUpload extends FileUploadRequest {
    readonly parts?: readonly FileUploadPart[];
}

export interface FileAssetRequest extends FileActor {
    readonly assetId: string;
}

export interface FilePurposeTarget {
    readonly purposeKey: string;
    readonly resourceId: string;
}

export interface BindFileAsset extends FileActor, FilePurposeTarget {
    readonly assetId: string;
}

export interface FileReferenceRequest extends FileActor, FilePurposeTarget {
    readonly referenceId: string;
}

export interface FileReferenceQuery extends FileActor, FilePurposeTarget {
    readonly limit?: number;
    readonly cursor?: string;
}

export interface FileReferenceSnapshot {
    readonly id: string;
    readonly resourceId: string;
    readonly purposeKey: string;
    readonly sortOrder: number;
    readonly createdAt: Date;
    readonly removedAt: Date | null;
    readonly asset: FileAssetSnapshot;
}

export interface FileReferencePage {
    readonly items: readonly FileReferenceSnapshot[];
    readonly nextCursor: string | null;
}

export interface FileReferenceDownload {
    readonly reference: FileReferenceSnapshot;
    readonly request: PresignedRequest;
}

export interface FileUploadSnapshot {
    readonly id: string;
    readonly status: 'open' | 'finalizing' | 'completed' | 'cancelled' | 'expired';
    readonly mode: 'single' | 'multipart';
    readonly filename: string;
    readonly contentType: string;
    readonly sizeBytes: string;
    readonly expiresAt: Date;
    readonly assetId: string | null;
    readonly partSizeBytes: number | null;
    readonly partCount: number;
    readonly completionParts: readonly FileUploadPart[] | null;
    readonly purpose: FilePurposeTarget | null;
}

export interface FileAssetSnapshot {
    readonly id: string;
    readonly organizationId: string;
    readonly uploadedById: string;
    readonly filename: string;
    readonly contentType: string;
    /** Decimal string to avoid BigInt leaking through a JSON boundary. */
    readonly sizeBytes: string;
    readonly sha256: string;
    readonly createdAt: Date;
    readonly unboundExpiresAt: Date | null;
}

export interface FileUploadProgress {
    readonly session: FileUploadSnapshot;
    readonly parts: readonly (FileUploadPart & { readonly sizeBytes: number })[];
}

export interface FileDownload {
    readonly asset: FileAssetSnapshot;
    readonly request: PresignedRequest;
}

export interface FileCleanupResult {
    readonly expiredUploads: number;
    readonly expiredAssets: number;
    readonly cleanedSessions: number;
    readonly cleanedObjects: number;
    readonly failures: readonly { readonly kind: 'session' | 'object'; readonly id: string }[];
}
