import type { AccountDataSource } from './source';
import { createAccountFixture } from './fixture';

export function createMockAccountDataSource(): AccountDataSource {
    const account = createAccountFixture();
    return {
        async load() {
            return structuredClone(account);
        },
        async updateDisplayName(name) {
            const trimmed = name.trim();
            if (!trimmed || trimmed.length > 40) throw new Error('显示名称须为 1-40 个字符');
            account.displayName = trimmed;
        },
    };
}
