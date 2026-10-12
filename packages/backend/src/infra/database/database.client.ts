import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { normalizeDatabaseError } from './database.error.normalize.js';
import { createDatabaseQueryClient } from './database.query.js';
import { DatabaseTransactionContext } from './transaction/transaction.context.js';

import { AllConfig } from '@/config/index.js';

import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';

import { PrismaClient, type Prisma } from '@root/prisma/generated/client.js';

import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * @description Prisma 数据库服务
 * - 管理数据库连接生命周期
 * - 监控慢查询并记录日志
 * - 只记录耗时与上下文，不记录 SQL 或绑定参数
 */
@Injectable()
export class DatabaseClient implements OnApplicationShutdown, OnModuleInit {
    readonly client: PrismaClient<'query'>;
    readonly managed: ReturnType<typeof createDatabaseQueryClient>;

    constructor(
        private readonly configService: ConfigService<AllConfig, true>,
        private readonly alsContextAdapter: AlsContextAdapter,
        context: DatabaseTransactionContext,
        @InjectPinoLogger(DatabaseClient.name) private readonly logger: PinoLogger
    ) {
        const DATABASE_URL = configService.get('database.databaseUrl', { infer: true });
        if (!DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set');
        }
        const adapter = new PrismaPg({
            connectionString: DATABASE_URL,
            max: 12,
            min: 2, // 最小保持 2 个连接
            idleTimeoutMillis: 30000, // 30秒空闲超时
            connectionTimeoutMillis: 2000, // 2秒连接超时
        });

        this.client = new PrismaClient({
            adapter,
            log: [{ emit: 'event', level: 'query' }],
        });
        this.managed = createDatabaseQueryClient(this.client, context);
    }

    async onModuleInit() {
        try {
            await this.client.$connect();
            // PrismaPg creates its pool lazily; $connect alone does not prove reachability.
            await this.managed.$queryRaw`SELECT 1`;
        } catch (error) {
            throw normalizeDatabaseError(error);
        }
        this.logger.info({ event: 'database.connected' }, 'Database connected successfully');

        // 订阅查询事件（用于慢查询监控）
        this.client.$on('query', (event) => {
            this.handleQueryEvent(event);
        });
    }

    // 处理查询事件，检测慢查询并记录日志
    private handleQueryEvent(event: Prisma.QueryEvent) {
        const requestContext = this.alsContextAdapter.get();
        const { timestamp } = event;
        const duration = Math.round(event.duration);

        // 构造日志上下文
        const logContext = {
            event: 'database.query.completed',
            requestId: requestContext?.requestId || 'unknown',
            version: requestContext?.version || 'unknown',
            database: {
                duration,
                durationUnit: 'ms',
                timestamp: timestamp.toISOString(),
            },
        };

        const slowQueryThreshold = this.configService.get('observability.slowQueryThreshold', {
            infer: true,
        });

        // 根据查询耗时选择日志级别
        if (duration >= slowQueryThreshold.error) {
            logContext.event = 'database.query.critical';
            // 超过 500ms：error 级别
            this.logger.error(logContext, `Critical slow query (${duration}ms)`);
        } else if (duration >= slowQueryThreshold.warn) {
            logContext.event = 'database.query.slow';
            // 超过 100ms：warn 级别
            this.logger.warn(logContext, `Slow query (${duration}ms)`);
        } else {
            // 所有查询：debug 级别
            this.logger.debug(logContext, `Query executed (${duration}ms)`);
        }
    }

    async onApplicationShutdown() {
        try {
            await this.client.$disconnect();
        } catch (error) {
            throw normalizeDatabaseError(error);
        }
        this.logger.info({ event: 'database.disconnected' }, 'Database disconnected');
    }
}
