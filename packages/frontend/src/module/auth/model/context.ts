import { inject, type InjectionKey } from 'vue';
import type { AuthApi } from './auth';

export const authApiKey: InjectionKey<AuthApi> = Symbol('auth-api');

export function useAuthApi(): AuthApi {
    const api = inject(authApiKey);
    if (!api) throw new Error('Auth API is not provided');
    return api;
}
