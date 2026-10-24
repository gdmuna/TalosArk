import { DatabaseClient } from './database.client.js';
import { DatabaseRuntime } from './database.runtime.js';
import { DatabaseTransactionManager } from './transaction/transaction.manager.js';
import { DatabaseTransactionContext } from './transaction/transaction.context.js';

import { PlatformContextModule } from '@/platform/context/context.module.js';

import { Module } from '@nestjs/common';
import { LoggerExtension } from '@/platform/observability/logger/logger-contribution.decorator.js';
import { databaseLogContribution } from './database.log.contribution.js';

@LoggerExtension(databaseLogContribution)
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
