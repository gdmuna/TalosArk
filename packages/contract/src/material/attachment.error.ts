import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';

export const MaterialAttachmentErrorContract = {
    invalid: defineErrorContract(
        'MATERIAL_ATTACHMENT_INVALID',
        'The attachment request is invalid',
        z.null()
    ),
    unavailable: defineErrorContract(
        'MATERIAL_ATTACHMENT_UNAVAILABLE',
        'The material attachment is unavailable or access is denied',
        z.null()
    ),
    storageUnavailable: defineErrorContract(
        'MATERIAL_ATTACHMENT_STORAGE_UNAVAILABLE',
        'Attachment storage is temporarily unavailable',
        z.null()
    ),
    conflict: defineErrorContract(
        'MATERIAL_ATTACHMENT_CONFLICT',
        'The attachment operation conflicts with an existing request',
        z.null()
    ),
    expired: defineErrorContract(
        'MATERIAL_ATTACHMENT_EXPIRED',
        'The attachment upload session has expired',
        z.null()
    ),
    busy: defineErrorContract(
        'MATERIAL_ATTACHMENT_BUSY',
        'The attachment operation is already in progress',
        z.null()
    ),
    notReady: defineErrorContract(
        'MATERIAL_ATTACHMENT_NOT_READY',
        'The uploaded attachment is not ready for completion',
        z.null()
    ),
    format: defineErrorContract(
        'MATERIAL_ATTACHMENT_FORMAT_NOT_ALLOWED',
        'The attachment filename and declared type are not allowed',
        z.null()
    ),
    size: defineErrorContract(
        'MATERIAL_ATTACHMENT_SIZE_NOT_ALLOWED',
        'The attachment exceeds the material attachment size limit',
        z.null()
    ),
    integrity: defineErrorContract(
        'MATERIAL_ATTACHMENT_INTEGRITY_MISMATCH',
        'The uploaded attachment does not match its declared size or checksum',
        z.null()
    ),
    readonly: defineErrorContract(
        'MATERIAL_ATTACHMENT_READONLY',
        'Archived materials do not allow attachment changes',
        z.null()
    ),
    inUse: defineErrorContract(
        'MATERIAL_ATTACHMENT_IN_USE',
        'The attachment is already bound to a material',
        z.null()
    ),
} as const;
