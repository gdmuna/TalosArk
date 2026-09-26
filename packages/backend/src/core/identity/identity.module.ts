import { IdentityRepositoryModule } from './repository/identity.repository.module.js';
import { IdentityKernel } from './identity.kernel.js';

import { PrismaModule } from '@/infra/database/prisma/prisma.module.js';
import { IamModule } from '@/infra/iam/index.js';
import { KvsModule } from '@/infra/kvs/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [IdentityRepositoryModule, PrismaModule, KvsModule, IamModule],
    providers: [IdentityKernel],
    exports: [IdentityKernel],
})
export class IdentityModule {}
