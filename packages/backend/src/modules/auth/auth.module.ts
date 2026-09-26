import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

import { AccessModule } from '@/core/access/index.js';
import { IdentityModule } from '@/core/identity/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [AccessModule, IdentityModule],
    controllers: [AuthController],
    providers: [AuthService],
})
export class AuthModule {}
