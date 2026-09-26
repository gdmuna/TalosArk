import { IdentityRepository } from './identity.repository.js';
import { IdentityAccessRepo } from './repo-access.js';

import { PrismaModule } from '@/infra/database/prisma/prisma.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [PrismaModule],
    providers: [IdentityRepository, IdentityAccessRepo],
    exports: [IdentityRepository],
})
export class IdentityRepositoryModule {}
