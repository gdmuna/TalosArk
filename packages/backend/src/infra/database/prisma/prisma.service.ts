import { Logger } from '@/platform/observability/index.js';

import { AllConfig } from '@/config/index.js';

import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';

import { PrismaClient } from '@root/prisma/generated/client.js';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * @description Prisma 数据库服务
 * - 管理数据库连接生命周期
 * - 监控慢查询并记录日志
 * - 开发环境下记录所有 SQL 查询
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy, OnModuleInit {
    private readonly logger = new Logger(PrismaService.name);

    constructor(
        private readonly configService: ConfigService<AllConfig, true>,
        private readonly alsContextAdapter: AlsContextAdapter
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

        // 开发环境启用查询日志
        super({
            adapter,
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'warn' },
            ],
        });
    }

    async onModuleInit() {
        // 连接数据库
        await this.$connect();
        this.logger.log('Database connected successfully');

        // 订阅查询事件（用于慢查询监控）
        this.$on('query' as never, (event: any) => {
            this.handleQueryEvent(event);
        });

        // 订阅错误事件
        this.$on('error' as never, (event: any) => {
            const requestContext = this.alsContextAdapter.get();
            this.logger.error(
                {
                    requestId: requestContext?.requestId || 'unknown',
                    version: requestContext?.version || 'unknown',
                    database: {
                        target: event.target ?? 'Unknown',
                        timestamp: event.timestamp ?? new Date().toISOString(),
                    },
                    error: {
                        message: event.message ?? 'Unknown error',
                    },
                },
                `Database error occurred\n${event.stack ?? 'No stack trace available'}`
            );
        });

        // 订阅警告事件
        this.$on('warn' as never, (event: any) => {
            const requestContext = this.alsContextAdapter.get();
            this.logger.warn(
                {
                    requestId: requestContext?.requestId || 'unknown',
                    version: requestContext?.version || 'unknown',
                    database: {
                        message: event.message ?? 'Unknown error',
                        timestamp: event.timestamp ?? new Date().toISOString(),
                    },
                },
                `Database warning\n${event.stack ?? 'No stack trace available'}`
            );
        });
    }

    // 处理查询事件，检测慢查询并记录日志
    private handleQueryEvent(event: { timestamp: Date; query: string; duration: number }) {
        const requestContext = this.alsContextAdapter.get();
        const { timestamp, query } = event;
        const duration = Math.round(event.duration);

        // 构造日志上下文
        const logContext = {
            requestId: requestContext?.requestId || 'unknown',
            version: requestContext?.version || 'unknown',
            database: {
                query: this.formatSql(query),
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
            // 超过 500ms：error 级别
            this.logger.error(logContext, `Critical slow query (${duration}ms)`);
        } else if (duration >= slowQueryThreshold.warn) {
            // 超过 100ms：warn 级别
            this.logger.warn(logContext, `Slow query (${duration}ms)`);
        } else {
            // 所有查询：debug 级别
            this.logger.debug(logContext, `Query executed (${duration}ms)`);
        }
    }

    private formatSql(sql: string): string {
        return sql.replace(/"([^"]+)"/g, '$1');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Database disconnected');
    }
}
