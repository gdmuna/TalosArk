export { PermissionKernel } from './permission.kernel.js';
export { PermissionModule } from './permission.module.js';
export { PermissionConfigurationModule } from './permission.configuration.js';
export { AuthorizationExtension } from './authorization-extension.decorator.js';
export { PermissionError } from './permission.error.js';
export { parsePermissionCheck } from './internal/permission.input.js';
export type {
    PermissionSubject,
    PermissionScope,
    PermissionCheck,
    PermissionScopeQuery,
    PermissionDecision,
    PermissionRole,
    CreatePermissionRole,
    PermissionRoleBinding,
} from './permission.contract.js';
export type {
    AuthorizationDefinition,
    AuthorizationMetadata,
    AuthorizationScope,
    AuthorizationRegistryOptions,
} from './authorization-definition.js';
