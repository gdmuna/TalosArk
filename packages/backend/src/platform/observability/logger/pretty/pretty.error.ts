import { logObject, type PrettyLog } from './pretty.adapter.js';
import { inlineText, terminalText } from './pretty.text.js';

export function isDiagnostic(value: unknown): value is PrettyLog {
    const error = logObject(value);
    return !!error && typeof error.type === 'string';
}

function hasBranches(error: PrettyLog, depth = 0): boolean {
    if (error.type === 'AggregateError' || Array.isArray(error.errors)) return true;
    return depth < 8 && isDiagnostic(error.cause) && hasBranches(error.cause, depth + 1);
}

export function formatLinearError(
    error: PrettyLog,
    formatFields: (fields: PrettyLog) => string,
    label?: string
): string | undefined {
    // A branching cause remains an object so every stack stays attached to its own error.
    if (hasBranches(error)) return undefined;
    const lines: string[] = [];
    let current: PrettyLog | undefined = error;
    let depth = 0;
    while (current && depth <= 8) {
        const identity = [current.id, current.code].filter((value) => typeof value === 'string');
        const heading = `${inlineText(current.type)}${identity.length ? ` [${identity.map(inlineText).join(', ')}]` : ''}`;
        const prefix = depth ? 'Caused by: ' : label ? `${label}: ` : '';
        const message =
            typeof current.message === 'string' ? `: ${inlineText(current.message)}` : '';
        lines.push(`    ${prefix}${heading}${message}\n`);
        const fields = { ...current };
        for (const key of ['type', 'id', 'code', 'message', 'stack', 'cause']) delete fields[key];
        lines.push(formatFields(fields));
        if (typeof current.stack === 'string' && current.stack) {
            lines.push(
                terminalText(current.stack)
                    .split('\n')
                    .map((frame) => `    ${frame.trimStart()}\n`)
                    .join('')
            );
        }
        current = isDiagnostic(current.cause) ? current.cause : undefined;
        depth++;
    }
    return lines.join('');
}
