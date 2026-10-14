import _package_info from '@root/package.json' with { type: 'json' };

import { registerAs, ConfigType } from '@nestjs/config';
import { z } from 'zod/v4';
import { parseEnvironment } from './internal/config.validation.js';

// app

const _allowedEnvValue = ['development', 'test', 'production'] as const;

export const NODE_ENV = _allowedEnvValue.includes(process.env.NODE_ENV as any)
    ? (process.env.NODE_ENV as (typeof _allowedEnvValue)[number])
    : 'development';

export const PORT = process.env.PORT || 3000;

export const PACKAGE_INFO = _package_info;

export const APP_VERSION = process.env.APP_VERSION || PACKAGE_INFO.version || 'unknown';

export const APP_NAME = process.env.APP_NAME || PACKAGE_INFO.name || 'unknown';

export const APP_AUTHOR = process.env.APP_AUTHOR || PACKAGE_INFO.author || 'unknown';

export const GIT_COMMIT = process.env.GIT_COMMIT || 'N/A';

export const IS_DEV = process.env.NODE_ENV === 'development';

export const IS_TEST = process.env.NODE_ENV === 'test';

export const IS_PROD = process.env.NODE_ENV === 'production';

const AppConfigValidateSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        PORT: z.coerce.number().default(3000),
        APP_NAME: z.preprocess(
            (v) => v || undefined,
            z.string().default(PACKAGE_INFO.name || 'N/A')
        ),
        APP_VERSION: z.preprocess(
            (v) => v || undefined,
            z.string().default(PACKAGE_INFO.version || 'N/A')
        ),
        APP_AUTHOR: z.preprocess(
            (v) => v || undefined,
            z.string().default(PACKAGE_INFO.author || 'N/A')
        ),
        // prettier-ignore
        GIT_COMMIT: z.preprocess(
            (v) => v || undefined,
            z.string().default('N/A')
        ),
    })
    .transform((env) => ({
        nodeEnv: env.NODE_ENV,
        port: env.PORT,
        appName: env.APP_NAME,
        appVersion: env.APP_VERSION,
        gitCommit: env.GIT_COMMIT,
        isDev: env.NODE_ENV === 'development',
        isTest: env.NODE_ENV === 'test',
        isProd: env.NODE_ENV === 'production',
        packageInfo: PACKAGE_INFO,
    }));

export const appConfig = registerAs('app', () =>
    parseEnvironment(AppConfigValidateSchema, 'application')
);

export type AppConfig = ConfigType<typeof appConfig>;
