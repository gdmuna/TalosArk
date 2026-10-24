import { MaterialErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';

export const MaterialError = defineErrorClass(MaterialErrorDefinition, { name: 'MaterialError' });
