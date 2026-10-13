import type { AccountProfile } from '../model/account';

export interface AccountDataSource {
    load(signal?: AbortSignal): Promise<AccountProfile>;
    updateDisplayName(name: string): Promise<void>;
}
