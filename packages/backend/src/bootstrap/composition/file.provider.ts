import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@/config/index.js';
import { FileConfigurationModule } from '@/core/file/index.js';

export const fileConfiguration = FileConfigurationModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService<AllConfig, true>) => {
        const { bucketPrivate, bucketStaging } = config.get('storage', { infer: true });
        return { privateBucket: bucketPrivate, stagingBucket: bucketStaging };
    },
});
