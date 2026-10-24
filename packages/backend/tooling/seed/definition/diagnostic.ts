import { z } from 'zod';

/** Definition diagnostics retain location, not arbitrary parameter values. */
export class SeedDefinitionError extends Error {
    readonly code = 'seed.invalid-definition';
    readonly issues: readonly { path: string; code: string }[];
    constructor(
        readonly definitionId: string,
        readonly stepKey: string | undefined,
        cause: unknown
    ) {
        const issues =
            cause instanceof z.ZodError
                ? cause.issues.map((issue) => ({
                      path: issue.path.join('.') || '<root>',
                      code: issue.code,
                  }))
                : [];
        const detail = issues.length
            ? issues.map((issue) => `${issue.path} (${issue.code})`).join(', ')
            : cause instanceof Error
              ? cause.message
              : 'Definition construction failed';
        super(
            `[seed.invalid-definition] ${definitionId}${stepKey ? ` / step ${stepKey}` : ''}: ${detail}`,
            { cause }
        );
        this.name = 'SeedDefinitionError';
        this.issues = issues;
    }
}
