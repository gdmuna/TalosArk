import type { AccountProfile } from '../model/account';

export interface AccountDataSource {
    load(): Promise<AccountProfile>;
    updateDisplayName(name: string): Promise<void>;
}
