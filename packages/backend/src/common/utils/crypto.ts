import { createHash, randomBytes } from 'node:crypto';

export function createSecureRandomString(byteLength = 32): string {
    if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
        throw new RangeError('byteLength must be a positive safe integer');
    }

    return randomBytes(byteLength).toString('base64url');
}

export function hashSHA256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}
