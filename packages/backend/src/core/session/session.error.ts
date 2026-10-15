import { AccessErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/error.factory.js';

export const SessionError = defineErrorClass(AccessErrorDefinition, { name: 'SessionError' });
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type SessionError = InstanceType<typeof SessionError>;
export type SessionFailure = SessionError['failure'];
