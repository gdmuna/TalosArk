import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@/config/index.js';
import type { IamModuleAsyncOptions } from '@/infra/iam/index.js';
import type { MailModuleAsyncOptions } from '@/infra/mail/index.js';
import type { StorageModuleAsyncOptions } from '@/infra/storage/index.js';

export const iamOptions: IamModuleAsyncOptions = {
    inject: [ConfigService],
    useFactory: (config: ConfigService<AllConfig, true>) => {
        const { oidc, sdkConfig } = config.get('casdoor', { infer: true });
        return {
            options: {
                ...oidc,
                organization: sdkConfig.orgName,
                application: sdkConfig.appName,
            },
        };
    },
};

export const mailOptions: MailModuleAsyncOptions = {
    inject: [ConfigService],
    useFactory: (config: ConfigService<AllConfig, true>) => ({
        options: config.get('mail', { infer: true }),
    }),
};

export const storageOptions: StorageModuleAsyncOptions = {
    inject: [ConfigService],
    useFactory: (config: ConfigService<AllConfig, true>) => {
        const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle, publicBaseUrl } =
            config.get('storage', { infer: true });
        return {
            options: {
                endpoint,
                region,
                accessKeyId,
                secretAccessKey,
                forcePathStyle,
                publicBaseUrl,
            },
        };
    },
};
