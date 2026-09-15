import { readFile } from '@/shared/utils/helpers/file.helper.js';

import { registerAs, ConfigType } from '@nestjs/config';
import { z } from 'zod';
import type { Algorithm } from 'jsonwebtoken';

// auth

const _algorithm = [
    'HS256',
    'HS384',
    'HS512',
    'RS256',
    'RS384',
    'RS512',
    'ES256',
    'ES384',
    'ES512',
    'PS256',
    'PS384',
    'PS512',
] as const satisfies readonly Exclude<Algorithm, 'none'>[];

type JwtSigningAlgorithm = (typeof _algorithm)[number];

const _JWT_ACCESS_TOKEN: Record<string, string> = {};
export const JWT_ACCESS_TOKEN = {
    get PRIVATE_KEY() {
        return (_JWT_ACCESS_TOKEN.PRIVATE_KEY ??=
            process.env.JWT_ACCESS_PRIVATE_KEY ||
            readFile('config/keys/jwt-private.pem').replace(/\\n/g, '\n'));
    },
    get PUBLIC_KEY() {
        return (_JWT_ACCESS_TOKEN.PUBLIC_KEY ??=
            process.env.JWT_ACCESS_PUBLIC_KEY ||
            readFile('config/keys/jwt-public.pem').replace(/\\n/g, '\n'));
    },
    get ALGORITHM() {
        return (_JWT_ACCESS_TOKEN.ALGORITHM ??= (() => {
            const v = process.env.JWT_ACCESS_ALGORITHM || 'ES256';
            return _algorithm.includes(v as JwtSigningAlgorithm) ? v : 'ES256';
        })()) as JwtSigningAlgorithm;
    },
    get EXPIRES_IN() {
        return (_JWT_ACCESS_TOKEN.EXPIRES_IN ??= process.env.JWT_ACCESS_EXPIRES_IN || '15m');
    },
};

const _JWT_REFRESH_TOKEN: Record<string, string> = {};
export const JWT_REFRESH_TOKEN = {
    get PRIVATE_KEY() {
        return (_JWT_REFRESH_TOKEN.PRIVATE_KEY ??=
            process.env.JWT_REFRESH_PRIVATE_KEY ||
            readFile('config/keys/jwt-private.pem').replace(/\\n/g, '\n'));
    },
    get PUBLIC_KEY() {
        return (_JWT_REFRESH_TOKEN.PUBLIC_KEY ??=
            process.env.JWT_REFRESH_PUBLIC_KEY ||
            readFile('config/keys/jwt-public.pem').replace(/\\n/g, '\n'));
    },
    get ALGORITHM() {
        return (_JWT_REFRESH_TOKEN.ALGORITHM ??= (() => {
            const v = process.env.JWT_REFRESH_ALGORITHM || 'ES256';
            return _algorithm.includes(v as JwtSigningAlgorithm) ? v : 'ES256';
        })()) as JwtSigningAlgorithm;
    },
    get EXPIRES_IN() {
        return (_JWT_REFRESH_TOKEN.EXPIRES_IN ??= process.env.JWT_REFRESH_EXPIRES_IN || '15m');
    },
};

export const REFRESH_TOKEN_COOKIE = {
    NAME: 'refresh_token',
    HTTP_ONLY: true,
    get SAME_SITE() {
        return (process.env.JWT_REFRESH_COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none';
    },
    get SECURE() {
        return process.env.JWT_REFRESH_COOKIE_SECURE === 'true';
    },
    get PATH() {
        return process.env.JWT_REFRESH_COOKIE_PATH || '/auth';
    },
    get MAX_AGE_MS() {
        return Number(process.env.JWT_REFRESH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);
    },
};

export const BCRYPT_SALT_ROUND = Number(process.env.BCRYPT_SALT_ROUND || 10);

const AuthConfigValidateSchema = z
    .object({
        // access token
        JWT_ACCESS_PRIVATE_KEY: z.preprocess(
            (v) => v || readFile('config/keys/jwt-private.pem').replace(/\\n/g, '\n'),
            z.string().min(1)
        ),
        JWT_ACCESS_PUBLIC_KEY: z.preprocess(
            (v) => v || readFile('config/keys/jwt-public.pem').replace(/\\n/g, '\n'),
            z.string().min(1)
        ),
        JWT_ACCESS_ALGORITHM: z.enum(_algorithm).default('ES256'),
        JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
        // refresh token
        JWT_REFRESH_PRIVATE_KEY: z.preprocess(
            (v) => v || readFile('config/keys/jwt-private.pem').replace(/\\n/g, '\n'),
            z.string().min(1)
        ),
        JWT_REFRESH_PUBLIC_KEY: z.preprocess(
            (v) => v || readFile('config/keys/jwt-public.pem').replace(/\\n/g, '\n'),
            z.string().min(1)
        ),
        JWT_REFRESH_ALGORITHM: z.enum(_algorithm).default('ES256'),
        JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
        // cookie
        JWT_REFRESH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
        JWT_REFRESH_COOKIE_SECURE: z
            .enum(['true', 'false'])
            .default('false')
            .transform((v) => v === 'true'),
        JWT_REFRESH_COOKIE_PATH: z.string().default('/auth'),
        JWT_REFRESH_COOKIE_MAX_AGE_MS: z.coerce.number().default(7 * 24 * 60 * 60 * 1000),
        // bcrypt
        BCRYPT_SALT_ROUND: z.coerce.number().int().min(8).max(14).default(10),
    })
    .transform((env) => ({
        accessToken: {
            privateKey:
                env.JWT_ACCESS_PRIVATE_KEY ||
                readFile('config/keys/jwt-private.pem').replace(/\\n/g, '\n'),
            publicKey:
                env.JWT_ACCESS_PUBLIC_KEY ||
                readFile('config/keys/jwt-public.pem').replace(/\\n/g, '\n'),
            algorithm: env.JWT_ACCESS_ALGORITHM,
            expiresIn: env.JWT_ACCESS_EXPIRES_IN,
        },
        refreshToken: {
            privateKey:
                env.JWT_REFRESH_PRIVATE_KEY ||
                readFile('config/keys/jwt-private.pem').replace(/\\n/g, '\n'),
            publicKey:
                env.JWT_REFRESH_PUBLIC_KEY ||
                readFile('config/keys/jwt-public.pem').replace(/\\n/g, '\n'),
            algorithm: env.JWT_REFRESH_ALGORITHM,
            expiresIn: env.JWT_REFRESH_EXPIRES_IN,
        },
        refreshTokenCookie: {
            name: 'refresh_token',
            httpOnly: true,
            sameSite: env.JWT_REFRESH_COOKIE_SAME_SITE, // 'lax' | 'strict' | 'none'
            secure: env.JWT_REFRESH_COOKIE_SECURE,
            path: env.JWT_REFRESH_COOKIE_PATH,
            maxAgeMs: env.JWT_REFRESH_COOKIE_MAX_AGE_MS,
        },
        bcryptSaltRound: env.BCRYPT_SALT_ROUND,
    }));

export const authConfig = registerAs('auth', () => AuthConfigValidateSchema.parse(process.env));

export type AuthConfig = ConfigType<typeof authConfig>;
