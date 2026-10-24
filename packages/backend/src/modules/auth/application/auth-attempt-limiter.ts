import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AllConfig } from '@/config/index.js';
import { KvsClient, defineKvsKeyFamily } from '@/infra/kvs/index.js';
import { KvsError } from '@/infra/kvs/kvs.error.js';
import { defineErrorMapper } from '@/platform/error/error.mapper.js';
import { z } from 'zod';
import { AuthError } from '../auth.error.js';

const attempts = defineKvsKeyFamily({
    id: 'auth.attempt',
    canonical: 1,
    family: { 1: { category: 'auth', subtype: 'attempt', segments: [['bucket', z.string()]] } },
});
const increment = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return {n, redis.call('TTL', KEYS[1])}`;
const mapKvsError = defineErrorMapper(KvsError, AuthError, () => ({
    reason: 'unavailable' as const,
}));

@Injectable()
export class AuthAttemptLimiter {
    constructor(
        private readonly kvs: KvsClient,
        private readonly config: ConfigService<AllConfig, true>
    ) {}

    async check(scope: string, identifier: string, ip: string): Promise<void> {
        const settings = this.config.get('auth', { infer: true });
        for (const [bucket, value, limit] of [
            ['ip', ip, settings.ipAttemptLimit],
            ['account', identifier, settings.accountAttemptLimit],
        ] as const) {
            const digest = createHash('sha256').update(`${scope}:${bucket}:${value}`).digest('hex');
            const [count, ttl] = await this.increment(digest, settings.attemptWindowSeconds);
            if (count > limit)
                throw new AuthError(
                    { reason: 'attempts-limited' },
                    { retryAfterSeconds: Math.max(1, ttl) }
                );
        }
    }

    /** All syntactically valid emails use the same counters, including unknown accounts. */
    async checkRecoveryRequest(email: string, ip: string): Promise<boolean> {
        const settings = this.config.get('auth.recovery', { infer: true });
        const digest = (bucket: string, value: string) =>
            createHash('sha256').update(`recovery-request:${bucket}:${value}`).digest('hex');
        const [ipCount, ttl] = await this.increment(digest('ip', ip), settings.windowSeconds);
        if (ipCount > settings.ipLimit)
            throw new AuthError(
                { reason: 'attempts-limited' },
                { retryAfterSeconds: Math.max(1, ttl) }
            );
        const [emailCount] = await this.increment(digest('email', email), settings.windowSeconds);
        if (emailCount > settings.emailLimit) return false;
        const key = attempts.buildCanonical({ bucket: digest('cooldown', email) }).serialized;
        try {
            return (
                (await this.kvs.execute(() =>
                    this.kvs.redisClient.set(key, '1', {
                        NX: true,
                        EX: settings.cooldownSeconds,
                    })
                )) === 'OK'
            );
        } catch (error) {
            throw mapKvsError(error) ?? error;
        }
    }

    private async increment(
        digest: string,
        windowSeconds: number
    ): Promise<readonly [number, number]> {
        const key = attempts.buildCanonical({ bucket: digest }).serialized;
        let result: unknown;
        try {
            result = await this.kvs.execute(() =>
                this.kvs.redisClient.eval(increment, {
                    keys: [key],
                    arguments: [String(windowSeconds)],
                })
            );
        } catch (error) {
            throw mapKvsError(error) ?? error;
        }
        if (!Array.isArray(result) || result.length !== 2)
            throw new AuthError({ reason: 'unavailable' });
        const count = Number(result[0]);
        const ttl = Number(result[1]);
        if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(ttl) || ttl < 0)
            throw new AuthError({ reason: 'unavailable' });
        return [count, ttl];
    }
}
