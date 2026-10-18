import type { ExtensionEntry } from '@/platform/extensions/index.js';
import type { PermissionScope } from '@/core/permission/index.js';
import type { AuthorizationEntityTarget } from './authorization.contract.js';

export interface AuthorizationTargetQuery {
    readonly target: AuthorizationEntityTarget;
    readonly permissionCode: string;
}

export interface AuthorizationTargetFacts {
    readonly scope: PermissionScope;
}

/** Trusted domain facts only. Use queryClient; do not recursively authorize this lookup. */
export interface AuthorizationTargetProvider {
    /** null means missing or unavailable under the domain's action/lifecycle rules. */
    resolve(query: AuthorizationTargetQuery): Promise<AuthorizationTargetFacts | null>;
}

export interface AuthorizationTargetMetadata {
    readonly kind: string;
}

export interface AuthorizationTargetOptions {
    readonly explicit?: readonly ExtensionEntry<string, AuthorizationTargetProvider>[];
    /** Enabled by default; only static singleton provider instances are accepted. */
    readonly discovery?: boolean;
    readonly required?: readonly string[];
}
