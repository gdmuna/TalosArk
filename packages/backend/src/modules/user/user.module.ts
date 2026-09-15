import { UserController } from './user.controller.js';
import { UserService } from './internal/user.service.js';
import { UserRepository } from './internal/user.repository.js';
import { EmailVerificationRepository } from './internal/email-verification.repository.js';
import { IdentityKernelModule } from '@/core/identity/identity.module.js';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { MailModule } from '@/infra/mail/mail.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [IdentityKernelModule, DatabaseModule, MailModule],
    controllers: [UserController],
    providers: [UserService, UserRepository, EmailVerificationRepository],
})
export class UserModule {}
