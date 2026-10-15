import { SessionKernel } from './session.kernel.js';

import { DatabaseModule } from '@/infra/database/database.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule],
    providers: [SessionKernel],
    exports: [SessionKernel],
})
export class SessionModule {}
