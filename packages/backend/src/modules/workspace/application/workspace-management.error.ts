import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';

export const WorkspaceManagementError = defineErrorClass(TeamErrorDefinition, {
    name: 'WorkspaceManagementError',
});
