import { DatabaseService } from './database.service.js';

import { ContextModule } from '@/core/context/context.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [ContextModule],
    providers: [DatabaseService],
    exports: [DatabaseService],
})
export class DatabaseModule {}
