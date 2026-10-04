import type { AccountProfile } from '@/shared/models/account';

export function createAccountFixture(): AccountProfile {
    return { displayName: 'Maiturin', email: 'maiturin@example.com' };
}
