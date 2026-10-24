import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';

// Preserve the existing non-disclosing team 403 contract for missing and inaccessible contexts.
export const AuthorizationError = defineErrorClass(TeamErrorDefinition, {
    name: 'AuthorizationError',
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type AuthorizationError = InstanceType<typeof AuthorizationError>;
