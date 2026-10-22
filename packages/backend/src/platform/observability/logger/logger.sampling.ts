import type { LoggerOptions } from 'pino';
import { recordSamplingDrop } from './logger.telemetry.js';

/** Decide once before serialization, so every destination sees the same sample. */
export function samplingHooks(rate: number): NonNullable<LoggerOptions['hooks']> {
    if (rate === 1) return {};
    return {
        logMethod(args, method, level) {
            if (level >= 40 || (rate > 0 && Math.random() < rate)) method.apply(this, args);
            else recordSamplingDrop(level);
        },
    };
}
