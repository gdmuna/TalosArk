import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { ExtensionDiscoveryModule } from '@/platform/extensions/discovery/index.js';
import { TaskRepository } from './internal/task.repository.js';
import { TaskHandlerRegistry } from './task-handler.registry.js';
import { TaskKernel } from './task.kernel.js';
import { TaskExecutor } from './task.executor.js';

@Module({
    imports: [DatabaseModule, ExtensionDiscoveryModule],
    providers: [TaskRepository, TaskHandlerRegistry, TaskKernel, TaskExecutor],
    exports: [TaskRepository, TaskHandlerRegistry, TaskKernel, TaskExecutor],
})
export class TaskModule {}
