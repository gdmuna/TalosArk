export { AuthorizationKernel } from './authorization.kernel.js';
export { AuthorizationModule } from './authorization.module.js';
export { AuthorizationError } from './authorization.error.js';
export { AuthorizationConfigurationModule } from './authorization.configuration.js';
export { AuthorizationTargetExtension } from './authorization-target-extension.decorator.js';
export { AuthorizationTargetError } from './authorization-target.error.js';
export type {
    AuthorizationEntityTarget,
    AuthorizationTarget,
    AuthorizationRequest,
    AuthorizationDecision,
    AuthorizationScopeQuery,
    AuthorizedContext,
    ResolvedContext,
    AccessScope,
} from './authorization.contract.js';
export type {
    AuthorizationTargetQuery,
    AuthorizationTargetFacts,
    AuthorizationTargetProvider,
    AuthorizationTargetMetadata,
    AuthorizationTargetOptions,
} from './authorization-target.provider.js';
