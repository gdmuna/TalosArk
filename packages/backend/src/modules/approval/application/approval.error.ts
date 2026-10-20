import { ApprovalErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';
export const ApprovalError = defineErrorClass(ApprovalErrorDefinition, { name: 'ApprovalError' });
