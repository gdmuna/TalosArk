import { DatabaseClient } from './database.client.js';
import { DatabaseRuntime } from './database.runtime.js';
import { DatabaseTransactionManager } from './transaction/transaction.manager.js';
import { DatabaseTransactionContext } from './transaction/transaction.context.js';

import { PlatformContextModule } from '@/platform/context/context.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [PlatformContextModule],
    providers: [
        DatabaseTransactionContext,
        DatabaseClient,
        DatabaseTransactionManager,
        DatabaseRuntime,
    ],
    exports: [DatabaseRuntime],
})
export class DatabaseModule {}
