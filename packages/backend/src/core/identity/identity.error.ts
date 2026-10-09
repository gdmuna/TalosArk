import { IdentityErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/error.factory.js';

export const IdentityError = defineErrorClass(IdentityErrorDefinition, { name: 'IdentityError' });
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type IdentityError = InstanceType<typeof IdentityError>;
export type IdentityFailure = IdentityError['failure'];
