import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

import { AccessModule } from '@/core/access/index.js';
import { IdentityModule } from '@/core/identity/index.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [AccessModule, IdentityModule],
    controllers: [UserController],
    providers: [UserService],
})
export class UserModule {}
