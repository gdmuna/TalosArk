import { IdentityKernel } from './identity.kernel.js';

import { DatabaseModule } from '@/infra/database/database.module.js';
import { IamModule } from '@/infra/iam/index.js';
import { KvsModule } from '@/infra/kvs/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule, KvsModule, IamModule],
    providers: [IdentityKernel],
    exports: [IdentityKernel],
})
export class IdentityModule {}
