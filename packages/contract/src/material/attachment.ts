import { z } from 'zod';
import { UuidSchema } from '../protocol/scalar.js';
import { MaterialParamsSchema } from './material.js';

const filename = z.string().min(1).max(255);
const contentType = z.string().min(1).max(127);
const dateTime = z.iso.datetime();

export const MaterialAttachmentParamsSchema = MaterialParamsSchema;

export const MaterialAttachmentUploadModeSchema = z.enum(['single', 'multipart']);

export const MaterialAttachmentBeginSchema = z.strictObject({
    idempotencyKey: UuidSchema,
    filename,
    contentType,
    sizeBytes: z.number().int().min(0).max(5_000_000_000),
    sha256: z.string().regex(/^[0-9a-f]{64}$/i),
    mode: MaterialAttachmentUploadModeSchema,
});

export const MaterialAttachmentUploadParamsSchema = MaterialParamsSchema.extend({
    sessionId: UuidSchema,
});

export const MaterialAttachmentReferenceParamsSchema = MaterialParamsSchema.extend({
    referenceId: UuidSchema,
});

export const MaterialAttachmentSignSchema = z.strictObject({
    partNumber: z.number().int().min(1).max(10_000).optional(),
});

export const MaterialAttachmentPartSchema = z.strictObject({
    partNumber: z.number().int().min(1).max(10_000),
    etag: z.string().min(1).max(200),
});

export const MaterialAttachmentCompleteSchema = z.strictObject({
    parts: z.array(MaterialAttachmentPartSchema).max(10_000).optional(),
});

export const MaterialAttachmentQuerySchema = z.strictObject({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().min(1).max(1024).optional(),
});

export const MaterialAttachmentUploadSchema = z.object({
    id: UuidSchema,
    status: z.enum(['open', 'finalizing', 'completed', 'cancelled', 'expired']),
    mode: MaterialAttachmentUploadModeSchema,
    filename,
    contentType,
    sizeBytes: z.string().regex(/^\d+$/),
    expiresAt: dateTime,
    assetId: UuidSchema.nullable(),
    partSizeBytes: z.number().int().positive().nullable(),
    partCount: z.number().int().positive(),
    completionParts: z.array(MaterialAttachmentPartSchema).nullable(),
});

export const MaterialAttachmentProgressSchema = z.object({
    session: MaterialAttachmentUploadSchema,
    parts: z.array(
        MaterialAttachmentPartSchema.extend({ sizeBytes: z.number().int().nonnegative() })
    ),
});

export const MaterialAttachmentPresignedRequestSchema = z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'PUT']),
    headers: z.record(z.string(), z.string()),
    expiresAt: dateTime,
});

export const MaterialAttachmentReferenceSchema = z.object({
    id: UuidSchema,
    filename,
    contentType,
    sizeBytes: z.string().regex(/^\d+$/),
    createdAt: dateTime,
    removedAt: dateTime.nullable(),
});

export const MaterialAttachmentPageSchema = z.object({
    items: z.array(MaterialAttachmentReferenceSchema),
    nextCursor: z.string().nullable(),
});

export const MaterialAttachmentDownloadSchema = z.object({
    attachment: MaterialAttachmentReferenceSchema,
    request: MaterialAttachmentPresignedRequestSchema,
});

export const MaterialAttachmentBindSchema = z.strictObject({ assetId: UuidSchema });

export type MaterialAttachmentParams = z.infer<typeof MaterialAttachmentParamsSchema>;
export type MaterialAttachmentBegin = z.infer<typeof MaterialAttachmentBeginSchema>;
export type MaterialAttachmentUploadParams = z.infer<typeof MaterialAttachmentUploadParamsSchema>;
export type MaterialAttachmentReferenceParams = z.infer<
    typeof MaterialAttachmentReferenceParamsSchema
>;
export type MaterialAttachmentSign = z.infer<typeof MaterialAttachmentSignSchema>;
export type MaterialAttachmentComplete = z.infer<typeof MaterialAttachmentCompleteSchema>;
export type MaterialAttachmentQuery = z.infer<typeof MaterialAttachmentQuerySchema>;
export type MaterialAttachmentBind = z.infer<typeof MaterialAttachmentBindSchema>;
export type MaterialAttachmentPage = z.infer<typeof MaterialAttachmentPageSchema>;
export type MaterialAttachmentUpload = z.infer<typeof MaterialAttachmentUploadSchema>;
export type MaterialAttachmentProgress = z.infer<typeof MaterialAttachmentProgressSchema>;
export type MaterialAttachmentPresignedRequest = z.infer<
    typeof MaterialAttachmentPresignedRequestSchema
>;
export type MaterialAttachmentReference = z.infer<typeof MaterialAttachmentReferenceSchema>;
export type MaterialAttachmentDownload = z.infer<typeof MaterialAttachmentDownloadSchema>;
