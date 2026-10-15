import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

import { SessionModule } from '@/core/session/index.js';
import { IdentityModule } from '@/core/identity/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [SessionModule, IdentityModule],
    controllers: [UserController],
    providers: [UserService],
})
export class UserModule {}
