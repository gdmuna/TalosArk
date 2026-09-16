import { APP_NAME } from '@/config/index.js';

import os from 'os';

type Message = string | Error | Record<string, any>;

export class ConsoleFormatter {
    private static readonly LEVELS = {
        verbose: 10,
        debug: 20,
        log: 30,
        warn: 40,
        error: 50,
        fatal: 60,
    };

    static format(level: keyof typeof this.LEVELS, message: Message, context?: string) {
        return JSON.stringify({
            level: this.LEVELS[level],
            time: Date.now(),
            pid: process.pid,
            hostname: os.hostname(),
            name: APP_NAME,
            ...this.formatMsgAndCtx(message, context),
        });
    }

    private static formatMsgAndCtx(message: Message, context?: string) {
        if (typeof message === 'string') return { msg: message };
        else if (message instanceof Error)
            return {
                msg: message.stack ?? context ?? message.message ?? 'N/A',
            };
        return {
            ...message,
            msg: context ?? message.message ?? message.msg ?? 'N/A',
        };
    }
}
