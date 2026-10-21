import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

const messages = {
    'invalid-input': 'Background task input is invalid',
    'invalid-handler': 'Background task contribution is invalid',
    'not-ready': 'Background task registry is not ready',
    'unknown-handler': 'Background task handler is not registered',
    'lease-lost': 'Background task execution lease was lost',
    'invalid-state': 'Background task cannot perform this operation',
    timeout: 'Background task exceeded its execution deadline',
    stopping: 'Background task runtime is stopping',
    'close-timeout': 'Background task runtime exceeded its shutdown budget',
} as const;
export const TaskError = defineErrorClass(
    defineInternalErrorCatalog('task', Object.keys(messages) as (keyof typeof messages)[]),
    { name: 'TaskError', diagnosticMessage: (failure) => messages[failure.reason] }
);

/** Code is an owner-approved safe label; never put provider replies or payloads here. */
export class TaskFailure extends Error {
    constructor(
        readonly disposition: 'retry' | 'permanent' | 'unknown',
        readonly code: string
    ) {
        if (!/^[a-z][a-z0-9_.-]{0,99}$/.test(code))
            throw new TypeError('Invalid task failure code');
        super(`Background task failed (${code})`);
        this.name = 'TaskFailure';
    }
}
