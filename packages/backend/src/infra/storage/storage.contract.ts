import type { Readable } from 'node:stream';

/** Actual bucket and raw, unencoded key. Neither identifies an authorized file asset. */
export interface ObjectLocation {
    readonly bucket: string;
    readonly key: string;
}

export interface ObjectWriteOptions {
    readonly contentType?: string;
    /** Full payload SHA-256, encoded as 64 hexadecimal characters. */
    readonly sha256?: string;
}

export interface PresignOptions {
    /** Seconds, from 1 to 604800; defaults to 3600. */
    readonly expiresIn?: number;
}

export interface PresignedRequest {
    readonly url: string;
    readonly method: 'GET' | 'PUT';
    /** Send these headers unchanged; the browser supplies Host itself. */
    readonly headers: Readonly<Record<string, string>>;
    /** Nominal signature expiry; underlying credentials may expire earlier. */
    readonly expiresAt: Date;
}

export interface ObjectChecksum {
    readonly algorithm: 'sha256';
    /** Provider-reported value, not an ETag or a hexadecimal content address. */
    readonly value: string;
    /** Missing type must not be interpreted as a verified full-object hash. */
    readonly type?: 'full-object' | 'composite';
}

export interface ObjectStat {
    readonly sizeBytes: number;
    readonly contentType?: string;
    readonly etag?: string;
    readonly lastModifiedAt?: Date;
    readonly checksum?: ObjectChecksum;
}

export interface ObjectStatOptions {
    /** Opt in: provider support and additional permissions may be required. */
    readonly checksum?: boolean;
}

export interface StreamUploadOptions {
    readonly contentType?: string;
    readonly onProgress?: (loaded: number, total?: number) => void;
}

export type ObjectBody = Buffer | Uint8Array | string;
export type StreamBody = Readable | Buffer;

/** Storage handle only; File owns session identity, ownership, expiry and readiness. */
export interface MultipartUpload {
    readonly object: ObjectLocation;
    readonly uploadId: string;
}

export interface MultipartUploadOptions {
    readonly contentType?: string;
    readonly checksumAlgorithm?: 'sha256';
}

export interface MultipartPartPresignOptions extends PresignOptions {
    /** This part's SHA-256, encoded as 64 hexadecimal characters. */
    readonly sha256?: string;
}

export interface UploadedPart {
    readonly partNumber: number;
    readonly etag: string;
    readonly sizeBytes: number;
    /** Base64 provider value for this part, when present. */
    readonly checksumSha256?: string;
}

export interface MultipartCompletionPart {
    readonly partNumber: number;
    readonly etag: string;
    /** This part's SHA-256, encoded as 64 hexadecimal characters. */
    readonly sha256?: string;
}
