import { createCommand, type CliContext } from '../cli/context.js';
import {
    addRuntimeEnvironment,
    selectRuntimeEnvironment,
    loadRuntimeEnvironment,
} from '../cli/environment/runtime.js';
import { invokeRuntime } from '../cli/compiled.js';
import { z } from 'zod';

export async function run(args: string[], context: CliContext): Promise<void> {
    const command = addRuntimeEnvironment(createCommand('tool task'))
        .argument('[action]', 'failures | inspect | retry | file-cleanup | prune | recover')
        .argument('[id]', 'Task ID for inspect/retry')
        .option('--note <text>', 'Retry operator and reason; excludes credentials')
        .option('--limit <number>', 'Bounded result/batch size, 1..200', '50');
    command.parse(args, { from: 'user' });
    const options = command.opts();
    const action = await context.input.choose({
        value: command.args[0],
        flag: '<action>',
        example: 'pnpm task failures',
        message: 'Task operation:',
        choices: ['failures', 'inspect', 'retry', 'file-cleanup', 'prune', 'recover'].map(
            (value) => ({ name: value, value })
        ),
    });
    const limit = z.coerce.number().int().min(1).max(200).parse(options.limit);
    const id = ['inspect', 'retry'].includes(action)
        ? await context.input.text({
              value: command.args[1],
              flag: '<id>',
              message: 'Task ID:',
              example: 'pnpm task inspect <id>',
              parse: (value) => z.uuid().parse(value),
          })
        : undefined;
    const note =
        action === 'retry'
            ? await context.input.text({
                  value: options.note,
                  flag: '--note',
                  message: 'Retry operator and reason:',
                  example: '--note "operator: repaired upstream"',
              })
            : undefined;
    const selected = await selectRuntimeEnvironment(context.input, options);
    await invokeRuntime(
        'task',
        { action, limit, id, note },
        loadRuntimeEnvironment(selected.files)
    );
}
