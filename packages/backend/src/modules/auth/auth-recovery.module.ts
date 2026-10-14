import { Module } from '@nestjs/common';
import { IdentityModule } from '@/core/identity/index.js';
import { AccessModule } from '@/core/access/index.js';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { KvsModule } from '@/infra/kvs/index.js';
import { AuthHttpSession } from './api/auth-http-session.js';
import { AuthAttemptLimiter } from './application/auth-attempt-limiter.js';
import { PasswordRecoveryService } from './application/password-recovery.service.js';
import { PasswordRecoveryController } from './api/password-recovery.controller.js';

@Module({
    imports: [IdentityModule, AccessModule, DatabaseModule, KvsModule],
    controllers: [PasswordRecoveryController],
    providers: [PasswordRecoveryService, AuthHttpSession, AuthAttemptLimiter],
})
export class AuthRecoveryModule {}
