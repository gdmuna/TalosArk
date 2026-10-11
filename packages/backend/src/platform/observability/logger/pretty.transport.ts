import { styleText } from 'node:util';
import pretty from 'pino-pretty';

export default function prettyTransport(options: pretty.PrettyOptions = {}): pretty.PrettyStream {
    const colorize = options.colorize ?? pretty.isColorSupported;

    return pretty({
        sync: false,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        levelFirst: false,
        ...options,
        colorize,
        ignore: options.ignore ?? 'hostname,context',
        customColors: 'trace:gray,debug:blue,info:green,warn:yellow,error:red,fatal:bgRed',
        useOnlyCustomProps: false,
        messageFormat(log, messageKey, _levelLabel, { colors }) {
            const context = log.context ? `${colors.cyan(`[${terminalText(log.context)}]`)} ` : '';
            return context + colors.reset(terminalText(log[messageKey] ?? ''));
        },
        customPrettifiers: {
            time(value) {
                const text = `[${terminalText(value)}]`;
                // The time hook receives no color helpers, unlike the other prettifiers.
                return colorize ? styleText('gray', text, { validateStream: false }) : text;
            },
            level(value, _key, log, { label, labelColorized, colors }) {
                const level =
                    Number(value) === 60
                        ? colors.bold(colors.bgRed(colors.white(label)))
                        : labelColorized;
                const record = log as Record<string, unknown>;
                let metadata = [record.name, record.pid]
                    .filter(Boolean)
                    .map(terminalText)
                    .join('/');
                if (record.hostname) {
                    metadata += `${metadata ? ' on ' : 'on '}${terminalText(record.hostname)}`;
                }

                // This hook runs on the display copy before pretty assembles its metadata.
                // Render the whole block here so its delimiters share the field color.
                delete record.name;
                delete record.pid;
                delete record.hostname;
                return metadata ? `${level} ${colors.gray(`(${metadata})`)}` : level;
            },
        },
    });
}

function terminalText(value: unknown): string {
    // Function-format hooks bypass pino-pretty's default terminal escaping.
    // eslint-disable-next-line no-control-regex
    return String(value).replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '');
}
