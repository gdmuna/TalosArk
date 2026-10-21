import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from '../src/bootstrap/composition/worker.module.js';
import { TaskKernel } from '../src/core/task/index.js';
import { TaskHandlerRegistry } from '../src/core/task/task-handler.registry.js';
import { DatabaseRuntime } from '../src/infra/database/database.runtime.js';
import { fileCleanupTask } from '../src/system/maintenance/file-cleanup.task.js';
import { TaskRepository } from '../src/core/task/internal/task.repository.js';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '../src/config/index.js';
import { BullmqRuntime } from '../src/infra/queue/bullmq/index.js';

const command = new Command()
    .name('task')
    .description('Trusted maintenance only; load an explicit runtime env with dotenvx.');
command
    .command('failures')
    .option('--limit <number>', 'Latest failed/review tasks, at most 200', '50')
    .action((options: { limit: string }) =>
        run(async (task) => {
            console.info(JSON.stringify(await task.listFailures(Number(options.limit)), null, 2));
        })
    );
command.command('inspect <id>').action((id: string) =>
    run(async (task) => {
        console.info(JSON.stringify(await task.inspect(id), null, 2));
    })
);
command
    .command('retry <id>')
    .requiredOption('--note <text>', 'Operator and reason; excludes credentials')
    .action((id: string, options: { note: string }) => run((task) => task.retry(id, options.note)));
command
    .command('file-cleanup')
    .option('--limit <number>', 'Bounded batch size', '50')
    .action((options: { limit: string }) =>
        run(async (task, database) => {
            const receipt = await database.transaction.run(() =>
                task.enqueue(fileCleanupTask, { limit: Number(options.limit) })
            );
            console.info(JSON.stringify(receipt));
        })
    );
command
    .command('prune')
    .description('Remove one batch of old succeeded/expired records; retain failures')
    .action(() =>
        run(async (_task, _database, app) => {
            const options = app.get(ConfigService<AllConfig, true>).get('queue', { infer: true });
            console.info(
                JSON.stringify({
                    deleted: await app
                        .get(TaskRepository)
                        .prune(
                            new Date(Date.now() - options.retentionDays * 86400_000),
                            options.batchSize
                        ),
                })
            );
        })
    );
command
    .command('recover')
    .description('Run one bounded dispatch/reconciliation scan without starting a worker')
    .action(() =>
        run(async (_task, _database, app) => {
            const runtime = app.get(BullmqRuntime);
            await runtime.start(false);
            await runtime.tick();
            await runtime.stop();
        })
    );

async function run(
    work: (
        task: TaskKernel,
        database: DatabaseRuntime,
        app: import('@nestjs/common').INestApplicationContext
    ) => Promise<unknown>
) {
    const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));
    try {
        app.get(TaskHandlerRegistry).initialize();
        await work(app.get(TaskKernel), app.get(DatabaseRuntime), app);
    } finally {
        await app.close();
    }
}

await command.parseAsync().catch(() => {
    console.error('Task maintenance command failed; inspect application diagnostics.');
    process.exitCode = 1;
});
