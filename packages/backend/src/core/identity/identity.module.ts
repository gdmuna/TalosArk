import { LoginTransactionRepository } from './internal/login-transaction.repository.js';
import { IdentityRepository } from './internal/identity.repository.js';
import { SessionRepository } from './internal/session.repository.js';
import { TokenService } from './internal/token.service.js';
import { IdentityKernel } from './identity.kernel.js';

import { DatabaseModule } from '@/infra/database/database.module.js';
import { CasdoorModule } from '@/infra/iam/casdoor/casdoor.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule, CasdoorModule],
    providers: [
        IdentityKernel,
        IdentityRepository,
        LoginTransactionRepository,
        SessionRepository,
        TokenService,
    ],
    exports: [IdentityKernel],
})
export class IdentityKernelModule {}
