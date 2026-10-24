import { MaterialAttachmentErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';

export const MaterialAttachmentError = defineErrorClass(MaterialAttachmentErrorDefinition, {
    name: 'MaterialAttachmentError',
});
