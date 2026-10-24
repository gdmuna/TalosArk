import { Command, CommanderError } from 'commander';
import { InputResolver, errorMessage } from './input.js';

export interface CliContext {
    readonly input: InputResolver;
}
export interface ToolCommand {
    run(args: string[], context: CliContext): Promise<void>;
}

export function createCommand(name: string): Command {
    return new Command(name).exitOverride().showHelpAfterError();
}

export async function finish(work: () => Promise<void>): Promise<void> {
    try {
        await work();
    } catch (error) {
        if (error instanceof CommanderError && error.exitCode === 0) return;
        if (error instanceof Error && error.name === 'ExitPromptError') {
            console.error('[tool] Input canceled.');
            process.exitCode = 130;
        } else {
            if (!(error instanceof CommanderError)) console.error(`[tool] ${errorMessage(error)}`);
            if (!process.exitCode) process.exitCode = 1;
        }
    }
}
