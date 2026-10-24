import type { AccountProfile } from '../model/account';

export function createAccountFixture(): AccountProfile {
    return {
        id: '00000000-0000-4000-8000-000000000001',
        username: 'Maiturin',
        displayName: 'Maiturin',
        email: 'maiturin@example.com',
    };
}
