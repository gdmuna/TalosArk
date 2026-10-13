import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { deserialize } from '@phc/format';
import { argon2id, hash, verify } from 'argon2';
import { randomBytes } from 'node:crypto';
import type { AllConfig } from '@/config/index.js';
import { IdentityError } from '../identity.error.js';

const profile = Object.freeze({
    type: argon2id,
    version: 0x13,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
});

function isSupportedHash(encoded: string | null): encoded is string {
    if (encoded === null || encoded.length > 512) return false;
    try {
        const parsed = deserialize(encoded);
        return (
            parsed.id === 'argon2id' &&
            parsed.version === profile.version &&
            Object.keys(parsed.params ?? {}).length === 3 &&
            parsed.params?.m === profile.memoryCost &&
            parsed.params?.t === profile.timeCost &&
            parsed.params?.p === profile.parallelism &&
            parsed.salt?.length === 16 &&
            parsed.hash?.length === profile.hashLength
        );
    } catch (cause) {
        if (cause instanceof TypeError) return false;
        throw cause;
    }
}

@Injectable()
export class IdentityPasswordHasher implements OnModuleInit {
    private active = 0;
    private dummyHash?: string;
    private readonly concurrency: number;

    constructor(config: ConfigService<AllConfig, true>) {
        this.concurrency = config.get('identity.passwordHashConcurrency', { infer: true });
    }

    async onModuleInit(): Promise<void> {
        this.dummyHash = await this.compute(() => hash(randomBytes(32), profile));
    }

    hash(password: string): Promise<string> {
        return this.compute(() => hash(password, profile));
    }

    async verify(password: string, encoded: string | null): Promise<boolean> {
        const dummyHash = this.dummyHash;
        if (!dummyHash) throw new Error('Password hasher has not initialized');
        const supported = isSupportedHash(encoded);
        const matched = await this.compute(() => verify(supported ? encoded : dummyHash, password));
        return supported && matched;
    }

    private async compute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.active >= this.concurrency)
            throw new IdentityError({ reason: 'login-unavailable' }, { retryAfterSeconds: 1 });
        this.active++;
        try {
            return await operation();
        } catch (cause) {
            throw new IdentityError({ reason: 'login-unavailable' }, { cause });
        } finally {
            this.active--;
        }
    }
}
