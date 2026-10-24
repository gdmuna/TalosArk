import { z } from 'zod';
import { createCommand, type CliContext } from '../cli/context.js';
import {
    addRuntimeEnvironment,
    selectRuntimeEnvironment,
    loadRuntimeEnvironment,
} from '../cli/environment/runtime.js';
import { invokeRuntime } from '../cli/compiled.js';

export async function run(args: string[], context: CliContext): Promise<void> {
    if (args[0] === 'super-admin') {
        await (await import('./super-admin.js')).run(args.slice(1), context);
        return;
    }
    const command = addRuntimeEnvironment(createCommand('tool account'))
        .argument('[action]', 'provision | super-admin')
        .option('--username <name>', 'Case-sensitive account username')
        .option('--email <email>', 'Account email')
        .option('--database <name>', 'Confirm the target database name')
        .option('--reissue-activation', 'Reissue links for an unactivated operator-created account')
        .option('--show-activation-link', 'Explicit consent to print the secret activation link');
    command.parse(args, { from: 'user' });
    const action = await context.input.choose({
        value: command.args[0],
        flag: '<action>',
        message: 'Account operation:',
        example: 'pnpm account provision',
        choices: ['provision', 'super-admin'].map((value) => ({ name: value, value })),
    });
    if (action === 'super-admin') {
        await (await import('./super-admin.js')).run(args, context);
        return;
    }
    const options = command.opts();
    if (!options.showActivationLink)
        throw new Error(
            'Explicit --show-activation-link consent is required; no account was created.'
        );
    const username = await context.input.text({
        value: options.username,
        flag: '--username',
        message: 'Username:',
        example: '--username ExampleUser',
    });
    const email = await context.input.text({
        value: options.email,
        flag: '--email',
        message: 'Email:',
        example: '--email example@example.test',
        parse: (value) => z.email().parse(value),
    });
    const database = await context.input.text({
        value: options.database,
        flag: '--database',
        message: 'Confirm the connected database name:',
        example: '--database talosark_dev',
    });
    const selected = await selectRuntimeEnvironment(context.input, options);
    await invokeRuntime(
        'account',
        { username, email, database, reissueActivation: options.reissueActivation },
        loadRuntimeEnvironment(selected.files)
    );
}
