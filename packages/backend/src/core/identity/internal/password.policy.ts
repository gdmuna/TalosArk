import { LocalPasswordSchema } from '@talos-ark/contracts/auth/password';
import { IdentityError } from '../identity.error.js';

const blockedPasswords = new Set([
    'password123456789',
    '123456789012345',
    'qwertyuiopasdfgh',
    'passwordpassword',
    'letmeinletmeinletmein',
]);

export function assertNewPassword(password: string): void {
    if (
        !LocalPasswordSchema.safeParse(password).success ||
        password.trim().length === 0 ||
        blockedPasswords.has(password.toLowerCase())
    )
        throw new IdentityError({ reason: 'password-rejected' });
}
