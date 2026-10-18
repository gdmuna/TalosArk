import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';

export const TeamGovernanceError = defineErrorClass(TeamErrorDefinition, {
    name: 'TeamGovernanceError',
});
