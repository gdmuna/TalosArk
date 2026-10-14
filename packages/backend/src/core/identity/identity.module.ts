import { IdentityKernel } from './identity.kernel.js';
import { IdentityCredential } from './internal/identity.credential.js';
import { IdentityPasswordHasher } from './internal/password.hasher.js';

import { DatabaseModule } from '@/infra/database/database.module.js';
import { KvsModule } from '@/infra/kvs/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule, KvsModule],
    providers: [IdentityKernel, IdentityCredential, IdentityPasswordHasher],
    exports: [IdentityKernel],
})
export class IdentityModule {}
