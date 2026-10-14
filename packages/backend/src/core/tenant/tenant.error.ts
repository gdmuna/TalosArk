import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';

export const TenantError = defineErrorClass(TeamErrorDefinition, { name: 'TenantError' });
