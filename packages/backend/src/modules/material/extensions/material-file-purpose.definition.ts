import type { FilePurposeDefinition } from '@/core/file/index.js';

export const materialAttachmentPurpose = {
    key: 'material.attachment',
    resourceKind: 'MATERIAL',
    maxSizeBytes: 100 * 1024 * 1024,
    formats: {
        pdf: ['application/pdf'],
        docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        txt: ['text/plain'],
        md: ['text/markdown', 'text/plain'],
        csv: ['text/csv', 'application/csv'],
        jpg: ['image/jpeg'],
        jpeg: ['image/jpeg'],
        png: ['image/png'],
        webp: ['image/webp'],
        gif: ['image/gif'],
        tif: ['image/tiff'],
        tiff: ['image/tiff'],
    },
} as const satisfies FilePurposeDefinition;
