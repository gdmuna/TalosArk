import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import type { AllConfig } from '@/config/index.js';
import { BullmqRuntime } from '@/infra/queue/bullmq/index.js';
import { HealthState } from '@/system/health/health.state.js';
import { WorkerModule } from './composition/worker.module.js';
import { installProcessShutdown } from './lifecycle/shutdown.js';

export async function bootstrapWorker() {
    const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));
    const config = app.get(ConfigService<AllConfig, true>);
    const close = await installProcessShutdown(app, config.get('lifecycle', { infer: true }));
    try {
        if (!config.get('queue.enabled', { infer: true }))
            throw new Error('Worker requires TASK_ENABLED=true');
        await app.get(BullmqRuntime).start(true);
        app.get(HealthState).markReady();
        return { app, close };
    } catch (error) {
        await close();
        throw error;
    }
}
