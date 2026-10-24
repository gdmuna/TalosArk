import { defineExtensionPoint } from '@/platform/extensions/index.js';
import { createExtensionDecorator } from '@/platform/extensions/discovery/index.js';
import type { ResourceKind } from './resource-identity.js';

export const resourcePoint = defineExtensionPoint<{ readonly kind: ResourceKind }>(
    'resource.provider'
);
export const ResourceExtension: (metadata: { readonly kind: ResourceKind }) => ClassDecorator =
    createExtensionDecorator(resourcePoint);
