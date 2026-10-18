import type { PresignedRequest } from '@/infra/storage/index.js';

export interface FileActor {
    readonly organizationId: string;
    readonly userId: string;
}

export interface BeginFileUpload extends FileActor {
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

export interface FileUploadSnapshot {
    readonly id: string;
    readonly status: 'open' | 'finalizing' | 'completed' | 'cancelled' | 'expired';
    readonly mode: 'single' | 'multipart';
    readonly expiresAt: Date;
    readonly assetId: string | null;
    readonly partSizeBytes: number | null;
    readonly partCount: number;
    readonly completionParts: readonly FileUploadPart[] | null;
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
