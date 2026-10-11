import { styleText } from 'node:util';
import pretty from 'pino-pretty';
import type { PrettyAdapter, PrettyLog } from './pretty.adapter.js';
import { formatLinearError, isDiagnostic } from './pretty.error.js';
import { inlineText, terminalText } from './pretty.text.js';

const levels = new Map<number, { label: string; color: Parameters<typeof styleText>[0] }>([
    [10, { label: 'TRACE', color: 'gray' }],
    [20, { label: 'DEBUG', color: 'blue' }],
    [30, { label: 'INFO', color: 'green' }],
    [40, { label: 'WARN', color: 'yellow' }],
    [50, { label: 'ERROR', color: 'red' }],
    [60, { label: 'FATAL', color: ['bold', 'bgRed', 'white'] }],
]);

export function createPrettyRenderer(
    adapters: ReadonlyMap<string, PrettyAdapter>,
    colorize: boolean
): (record: PrettyLog) => string {
    const color = (style: Parameters<typeof styleText>[0], text: string) =>
        colorize ? styleText(style, text, { validateStream: false }) : text;
    const formatFields = pretty.prettyFactory({
        colorize,
        ignore: '',
        messageFormat: false,
        errorLikeObjectKeys: ['err', 'error', 'resolutionError'],
    });

    return (record) => {
        const level = levels.get(Number(record.level));
        const time = formatTime(record.time);
        const metadata = [record.name, record.pid]
            .filter((value) => value !== undefined && value !== null)
            .map(inlineText)
            .join('/');
        const header = [
            time ? color('gray', `[${time}]`) : '',
            level ? color(level.color, level.label) : inlineText(record.level ?? 'LOG'),
            metadata ? color('gray', `(${metadata})`) : '',
        ]
            .filter(Boolean)
            .join(' ');
        const context = record.context
            ? `${color('cyan', `[${inlineText(record.context)}]`)} `
            : '';
        let message = terminalText(record.msg ?? '');
        const adapter = typeof record.event === 'string' ? adapters.get(record.event) : undefined;
        if (adapter) {
            try {
                message = terminalText(adapter(record) ?? message);
            } catch {
                // A malformed event or adapter must not lose the original log record.
            }
        }

        // Only our private display copy is changed. Existing business object fields stay intact.
        const fields = { ...record };
        for (const key of ['time', 'level', 'name', 'pid', 'hostname', 'context', 'msg', 'event']) {
            delete fields[key];
        }
        const errors = Object.entries(fields).filter(
            ([key, value]) =>
                ['err', 'error', 'resolutionError'].includes(key) && isDiagnostic(value)
        );
        let errorText = '';
        for (const [key, value] of errors) {
            const formatted = formatLinearError(
                value as PrettyLog,
                formatFields,
                errors.length > 1 || key === 'resolutionError' ? key : undefined
            );
            if (formatted !== undefined) {
                errorText += formatted;
                delete fields[key];
            }
        }
        return `${header}: ${context}${message}\n${errorText}${formatFields(fields)}`;
    };
}

function formatTime(value: unknown): string | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    const pad = (number: number, length = 2) => String(number).padStart(length, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
