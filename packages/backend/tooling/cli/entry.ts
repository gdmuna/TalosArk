import { commands } from './registry.js';
import { createCommand, finish } from './context.js';
import { InputResolver } from './input.js';

await finish(async () => {
    const args = process.argv.slice(2);
    const separator = args.indexOf('--');
    const interactiveFlag = args.indexOf('--no-interactive');
    const interactive = interactiveFlag < 0 || (separator >= 0 && interactiveFlag > separator);
    if (!interactive) args.splice(interactiveFlag, 1);
    const context = { input: new InputResolver(interactive) };
    const available = commands.filter(
        (item) => !item.sourceOnly || import.meta.url.endsWith('.ts')
    );
    const help = createCommand('tool')
        .description(
            'Backend development and maintenance tools; all direct aliases share these implementations.'
        )
        .option('--no-interactive', 'Fail on missing input even in an interactive terminal')
        .addHelpText(
            'after',
            import.meta.url.endsWith('.ts')
                ? '\nExamples:\n  pnpm tool app dev\n  pnpm tool db prisma db push --env dev.local\n  pnpm seed plan --group minimal\n'
                : '\nExamples:\n  node dist/tooling/cli/entry.js task failures --env-process\n  node dist/tooling/cli/entry.js account --help\n'
        );
    for (const item of available) help.command(item.path.join(' ')).description(item.description);
    if (
        ['--help', '-h', 'help'].includes(args[0]) ||
        (!args.length && !context.input.interactive)
    ) {
        help.outputHelp();
        return;
    }
    if (!args.length) {
        const selected = await context.input.choose({
            flag: '<command>',
            message: 'Backend tool:',
            choices: available.map((item) => ({
                name: item.path.join(' '),
                description: item.description,
                value: item,
            })),
        });
        args.push(...selected.path);
    }
    const registration = available.find((item) =>
        item.path.every((part, index) => args[index] === part)
    );
    if (!registration) throw new Error(`Unknown tool "${args[0]}". Run pnpm tool --help.`);
    await (await registration.load()).run(args.slice(registration.path.length), context);
});
