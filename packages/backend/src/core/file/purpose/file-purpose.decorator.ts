import { defineExtensionPoint } from '@/platform/extensions/index.js';
import { createExtensionDecorator } from '@/platform/extensions/discovery/index.js';
import type { FilePurposeDefinition } from './file-purpose.definition.js';

export const filePurposePoint = defineExtensionPoint<FilePurposeDefinition>('file.purpose');
export const FilePurposeExtension: (definition: FilePurposeDefinition) => ClassDecorator =
    createExtensionDecorator(filePurposePoint);
