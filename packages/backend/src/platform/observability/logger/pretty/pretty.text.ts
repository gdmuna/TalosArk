export function terminalText(value: unknown): string {
    // Strip terminal controls before adding our own ANSI styles; keep tabs and newlines.
    // eslint-disable-next-line no-control-regex
    return String(value).replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '');
}

export function inlineText(value: unknown): string {
    return terminalText(value).replace(/[\n\t]/g, ' ');
}
