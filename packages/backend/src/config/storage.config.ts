import { registerAs, ConfigType } from '@nestjs/config';
import { z } from 'zod/v4';
import { parseEnvironment } from './internal/config.validation.js';

function normalizeS3Endpoint(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
}

const StorageConfigValidateSchema = z
    .object({
        S3_ENDPOINT: z
            .string()
            .min(1)
            .transform((v) => normalizeS3Endpoint(v))
            .pipe(z.url()),
        S3_REGION: z.string().min(1).default('us-east-1'),
        S3_ACCESS_KEY_ID: z.string().min(1),
        S3_SECRET_ACCESS_KEY: z.string().min(1),
        S3_BUCKET_PUBLIC: z.string().min(1).default('app-public'), // CDN 公开访问
        S3_BUCKET_PRIVATE: z.string().min(1).default('app-private'), // 鉴权访问
        S3_BUCKET_STAGING: z.string().min(1).default('app-staging'), // 暂存桶，生命周期由 File 管理
        S3_FORCE_PATH_STYLE: z
            .enum(['true', 'false'])
            .transform((v) => v === 'true')
            .default(true),
        S3_PUBLIC_BASE_URL: z
            .string()
            .optional()
            .transform((v) => (v ? normalizeS3Endpoint(v) : undefined)),
    })
    .transform((env) => ({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        bucketPublic: env.S3_BUCKET_PUBLIC,
        bucketPrivate: env.S3_BUCKET_PRIVATE,
        bucketStaging: env.S3_BUCKET_STAGING,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        publicBaseUrl: env.S3_PUBLIC_BASE_URL,
    }));

export const storageConfig = registerAs('storage', () =>
    parseEnvironment(StorageConfigValidateSchema, 'storage')
);

export type StorageConfig = ConfigType<typeof storageConfig>;
