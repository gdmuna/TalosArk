import { Module } from '@nestjs/common';
import { TaskModule } from '@/core/task/task.module.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { BullmqRuntime } from './bullmq.runtime.js';
import { BullmqTaskPublisher } from './bullmq-task-publisher.js';
import { BullmqWorkerAdapter } from './bullmq-worker.adapter.js';

@Module({
    imports: [TaskModule, PlatformContextModule],
    providers: [BullmqRuntime, BullmqTaskPublisher, BullmqWorkerAdapter],
    exports: [BullmqRuntime],
})
export class BullmqModule {}
