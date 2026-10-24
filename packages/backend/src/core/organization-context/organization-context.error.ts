import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';

export const OrganizationContextError = defineErrorClass(TeamErrorDefinition, {
    name: 'OrganizationContextError',
});
