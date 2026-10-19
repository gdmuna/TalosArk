import { FacilityErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/index.js';

export const FacilityError = defineErrorClass(FacilityErrorDefinition, { name: 'FacilityError' });
