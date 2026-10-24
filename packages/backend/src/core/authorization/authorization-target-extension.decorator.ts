import { defineExtensionPoint } from '@/platform/extensions/index.js';
import { createExtensionDecorator } from '@/platform/extensions/discovery/index.js';
import type { AuthorizationTargetMetadata } from './authorization-target.provider.js';

export const authorizationTargetPoint =
    defineExtensionPoint<AuthorizationTargetMetadata>('authorization.target');

/** Apply to an existing injectable singleton, not its module or individual methods. */
export const AuthorizationTargetExtension: (
    metadata: AuthorizationTargetMetadata
) => ClassDecorator = createExtensionDecorator(authorizationTargetPoint);
