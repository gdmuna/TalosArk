import { defineExtensionPoint } from '@/platform/extensions/index.js';
import { createExtensionDecorator } from '@/platform/extensions/discovery/index.js';
import type { AuthorizationMetadata } from './authorization-definition.js';

export const authorizationPoint = defineExtensionPoint<AuthorizationMetadata>(
    'permission.authorization'
);
export const AuthorizationExtension = createExtensionDecorator(authorizationPoint);
