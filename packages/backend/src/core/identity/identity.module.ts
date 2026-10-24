import { IdentityKernel } from './identity.kernel.js';
import { IdentityCredentialModule } from './identity-credential.module.js';

import { DatabaseModule } from '@/infra/database/database.module.js';
import { KvsModule } from '@/infra/kvs/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule, KvsModule, IdentityCredentialModule],
    providers: [IdentityKernel],
    exports: [IdentityKernel],
})
export class IdentityModule {}
