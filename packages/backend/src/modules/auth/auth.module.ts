import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

import { IdentityModule } from '@/core/identity/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [IdentityModule],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [],
})
export class AuthModule {}
