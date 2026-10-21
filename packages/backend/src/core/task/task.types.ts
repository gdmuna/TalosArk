import type { z } from 'zod';

export type TaskValue =
    string | number | boolean | null | TaskValue[] | { [key: string]: TaskValue };

export interface TaskPolicy {
    readonly maxAttempts: number;
    readonly timeoutMs: number;
    readonly backoff: { readonly type: 'fixed' | 'exponential'; readonly delay: number };
    /** Safe even if a prior attempt performed its effect but lost the acknowledgement. */
    readonly repeatable: boolean;
}

export interface TaskDefinition<T = unknown> {
    readonly kind: string;
    readonly version: number;
    readonly input: z.ZodType<T>;
    readonly policy: TaskPolicy;
}

export interface TaskContext {
    readonly jobId: string;
    readonly attempt: number;
    readonly signal: AbortSignal;
}

export interface TaskEnqueueOptions {
    readonly availableAt?: Date;
    readonly expiresAt?: Date;
    readonly sourceRequestId?: string;
}
