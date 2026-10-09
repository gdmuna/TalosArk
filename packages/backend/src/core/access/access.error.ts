import { AccessErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/error.factory.js';

export const AccessError = defineErrorClass(AccessErrorDefinition, { name: 'AccessError' });
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type AccessError = InstanceType<typeof AccessError>;
export type AccessFailure = AccessError['failure'];
