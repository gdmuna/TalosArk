export interface InputRequest<T> {
    value?: unknown;
    flag: string;
    example?: string;
    parse: (value: unknown) => T;
    prompt: (previous: unknown) => Promise<unknown>;
}

export class InputResolver {
    readonly interactive: boolean;

    constructor(interactive = true) {
        this.interactive = Boolean(
            interactive && process.stdin.isTTY && process.stdout.isTTY && !process.env.CI
        );
    }

    async require<T>(request: InputRequest<T>): Promise<T> {
        if (request.value !== undefined) {
            try {
                return request.parse(request.value);
            } catch (cause) {
                throw new Error(`Invalid ${request.flag}: ${errorMessage(cause)}`, { cause });
            }
        }
        if (!this.interactive)
            throw new Error(
                `Missing required argument ${request.flag} in a non-interactive terminal.` +
                    (request.example ? ` Example: ${request.example}` : '')
            );
        let previous: unknown;
        for (;;) {
            previous = await request.prompt(previous);
            try {
                return request.parse(previous);
            } catch (error) {
                console.error(`[tool] Invalid ${request.flag}: ${errorMessage(error)}`);
            }
        }
    }

    text(options: {
        value?: string;
        flag: string;
        message: string;
        example?: string;
        parse?: (value: unknown) => string;
    }): Promise<string> {
        return this.require({
            ...options,
            parse: options.parse ?? requiredText,
            prompt: async (previous) => {
                const { default: input } = await import('@inquirer/input');
                return input({
                    message: options.message,
                    default: typeof previous === 'string' ? previous : undefined,
                });
            },
        });
    }

    choose<T>(options: {
        value?: T;
        flag: string;
        message: string;
        example?: string;
        choices: readonly { name: string; value: T; description?: string }[];
    }): Promise<T> {
        return this.require({
            ...options,
            parse: (value) => {
                const choice = options.choices.find((item) => Object.is(item.value, value));
                if (!choice) throw new Error('choose one of the listed values');
                return choice.value;
            },
            prompt: async () => {
                const { default: select } = await import('@inquirer/select');
                return select({
                    message: options.message,
                    choices: [...options.choices],
                    loop: false,
                });
            },
        });
    }
}

export function requiredText(value: unknown, flag?: string): string {
    if (typeof value !== 'string' || !value.trim())
        throw new Error(
            flag ? `${flag} must be a non-empty text value` : 'a non-empty text value is required'
        );
    return value.trim();
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
