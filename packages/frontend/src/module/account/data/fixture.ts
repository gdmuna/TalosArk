import type { AccountProfile } from '../model/account';

export function createAccountFixture(): AccountProfile {
    return { displayName: 'Maiturin', email: 'maiturin@example.com' };
}
