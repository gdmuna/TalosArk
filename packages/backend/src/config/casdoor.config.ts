import { readFile } from '@/shared/utils/helpers/file.helper.js';

import { ConfigType, registerAs } from '@nestjs/config';
import { z } from 'zod/v4';

// 空字符串等同于未配置，避免环境模板中的占位值意外启用 Casdoor。
const OptionalCasdoorEnvironmentValue = z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined);

const CasdoorEnvironmentSchema = z.object({
    CASDOOR_ENDPOINT: OptionalCasdoorEnvironmentValue,
    CASDOOR_CLIENT_ID: OptionalCasdoorEnvironmentValue,
    CASDOOR_CLIENT_SECRET: OptionalCasdoorEnvironmentValue,
    CASDOOR_ORGANIZATION: OptionalCasdoorEnvironmentValue,
    CASDOOR_APPLICATION: OptionalCasdoorEnvironmentValue,
    CASDOOR_CERTIFICATE_PATH: OptionalCasdoorEnvironmentValue,
    CASDOOR_OIDC_REDIRECT_URI: OptionalCasdoorEnvironmentValue,
    CASDOOR_OIDC_ISSUER: OptionalCasdoorEnvironmentValue,
});

const ConfiguredCasdoorEnvironmentSchema = z.object({
    CASDOOR_ENDPOINT: z.url(),
    CASDOOR_CLIENT_ID: z.string().min(1),
    CASDOOR_CLIENT_SECRET: z.string().min(1),
    CASDOOR_ORGANIZATION: z.string().min(1),
    CASDOOR_APPLICATION: z.string().min(1).optional(),
    CASDOOR_CERTIFICATE_PATH: z.string().min(1),
    CASDOOR_OIDC_REDIRECT_URI: z.url().optional(),
    CASDOOR_OIDC_ISSUER: z.url().optional(),
});

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

/**
 * 解析 Casdoor 的可选平台配置。
 *
 * 未配置任何 `CASDOOR_*` 环境变量时，其 `sdkConfig` 字段为 `undefined`，以便尚未启用
 * Casdoor 的环境正常启动；一旦开始配置，所有字段和证书都必须完整有效。
 */
const CasdoorConfigValidateSchema = CasdoorEnvironmentSchema.transform((environment) => {
    if (Object.values(environment).every((value) => value === undefined)) {
        return { sdkConfig: undefined };
    }

    const configuredEnvironment = ConfiguredCasdoorEnvironmentSchema.parse(environment);
    const certificate = readFile(configuredEnvironment.CASDOOR_CERTIFICATE_PATH).replace(
        /\\n/g,
        '\n'
    );

    if (!certificate) {
        throw new Error(
            `无法读取 CASDOOR_CERTIFICATE_PATH 指定的 Casdoor 证书：${configuredEnvironment.CASDOOR_CERTIFICATE_PATH}`
        );
    }

    const endpoint = stripTrailingSlashes(configuredEnvironment.CASDOOR_ENDPOINT);
    const issuer = stripTrailingSlashes(configuredEnvironment.CASDOOR_OIDC_ISSUER ?? endpoint);

    return {
        sdkConfig: {
            endpoint,
            clientId: configuredEnvironment.CASDOOR_CLIENT_ID,
            clientSecret: configuredEnvironment.CASDOOR_CLIENT_SECRET,
            certificate,
            orgName: configuredEnvironment.CASDOOR_ORGANIZATION,
            appName: configuredEnvironment.CASDOOR_APPLICATION,
        },
        // 未提供回调地址时保留 SDK 管理能力，但明确禁用标准 OIDC 登录入口。
        oidc: configuredEnvironment.CASDOOR_OIDC_REDIRECT_URI
            ? {
                  endpoint,
                  issuer,
                  clientId: configuredEnvironment.CASDOOR_CLIENT_ID,
                  clientSecret: configuredEnvironment.CASDOOR_CLIENT_SECRET,
                  certificate,
                  redirectUri: configuredEnvironment.CASDOOR_OIDC_REDIRECT_URI,
              }
            : undefined,
    };
});

/** Casdoor 的平台级连接配置；`sdk` 在未启用时为 `undefined`。 */
export const casdoorConfig = registerAs('casdoor', () =>
    CasdoorConfigValidateSchema.parse(process.env)
);

export type CasdoorConfig = ConfigType<typeof casdoorConfig>;
