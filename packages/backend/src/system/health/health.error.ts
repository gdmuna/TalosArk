import { SystemErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/error.factory.js';

export const HealthError = defineErrorClass<typeof SystemErrorDefinition, { reason: 'notReady' }>(
    SystemErrorDefinition,
    { name: 'HealthError' }
);
