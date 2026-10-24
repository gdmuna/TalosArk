import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

import { SessionModule } from '@/core/session/index.js';
import { IdentityModule } from '@/core/identity/index.js';
import { AuthHttpSession } from './api/auth-http-session.js';
import { AuthAttemptLimiter } from './application/auth-attempt-limiter.js';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { KvsModule } from '@/infra/kvs/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [SessionModule, IdentityModule, DatabaseModule, KvsModule],
    controllers: [AuthController],
    providers: [AuthService, AuthHttpSession, AuthAttemptLimiter],
    exports: [AuthService],
})
export class AuthModule {}
