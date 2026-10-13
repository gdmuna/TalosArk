import { AuthErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/error.factory.js';

export const AuthError = defineErrorClass(AuthErrorDefinition, { name: 'AuthError' });
