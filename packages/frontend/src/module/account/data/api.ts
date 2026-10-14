import { CurrentAccountResponseSchema } from '@talos-ark/contracts/auth';
import type { HttpClient } from '@/platform/http';
import type { AccountDataSource } from './source';

export function createHttpAccountDataSource(http: HttpClient): AccountDataSource {
    return {
        async load(signal) {
            const account = await http.request({
                method: 'GET',
                path: '/user/me',
                schema: CurrentAccountResponseSchema,
                signal,
                retry: false,
            });
            return {
                id: account.id,
                username: account.username,
                displayName: account.profile?.nickname?.trim() || account.username,
                email: account.email,
            };
        },
    };
}
