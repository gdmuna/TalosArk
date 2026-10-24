import type { z } from 'zod';
import {
    parseConfiguration,
    type ValidationDiagnosticOptions,
} from '@/platform/error/error.validation.js';

export function parseEnvironment<S extends z.ZodType>(
    schema: S,
    name: string,
    options: ValidationDiagnosticOptions = {}
): z.output<S> {
    return parseConfiguration(schema, process.env, `${name} environment`, {
        ...options,
        environment: true,
    });
}
