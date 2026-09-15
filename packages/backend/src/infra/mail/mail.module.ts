import { MailService } from './mail.service.js';

import { Module } from '@nestjs/common';

@Module({
    providers: [MailService],
    exports: [MailService],
})
export class MailModule {}
