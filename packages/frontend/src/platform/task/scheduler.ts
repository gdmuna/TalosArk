import { assertDuration, createTaskScope, delay, waitFor } from './abort';

export interface ScheduledTaskOptions {
    id: string;
    intervalMs: number;
    task: (signal: AbortSignal) => Promise<void>;
    immediate?: boolean;
    signal?: AbortSignal;
    // Returning true continues after a failure; otherwise the task stops.
    onError?: (error: unknown) => boolean;
}

export interface ScheduledTask {
    stop(): void;
    readonly done: Promise<void>;
    readonly lastError: unknown;
}

export function createTaskScheduler() {
    const tasks = new Map<string, ScheduledTask>();
    let disposed = false;

    function schedule(options: ScheduledTaskOptions): ScheduledTask {
        if (disposed) throw new Error('Task scheduler is disposed');
        if (tasks.has(options.id)) throw new Error(`Task already scheduled: ${options.id}`);
        assertDuration(options.intervalMs, 'intervalMs');
        if (options.intervalMs === 0) throw new RangeError('intervalMs must be positive');
        const controller = new AbortController();
        const scope = createTaskScope([controller.signal, options.signal]);
        let lastError: unknown;

        async function run() {
            // Completion-based scheduling prevents slow requests from overlapping.
            try {
                if (options.immediate === false) await delay(options.intervalMs, scope.signal);
                while (!scope.signal.aborted) {
                    try {
                        await waitFor(
                            Promise.resolve().then(() => {
                                scope.signal.throwIfAborted();
                                return options.task(scope.signal);
                            }),
                            scope.signal
                        );
                    } catch (error) {
                        if (scope.signal.aborted) break;
                        lastError = error;
                        if (!options.onError?.(error)) break;
                    }
                    await delay(options.intervalMs, scope.signal);
                }
            } catch (error) {
                if (!scope.signal.aborted) lastError = error;
            } finally {
                scope.dispose();
                tasks.delete(options.id);
            }
        }

        const handle: ScheduledTask = {
            stop: () => controller.abort(),
            // Start after registration so immediate completion cannot leave a stale entry.
            done: Promise.resolve().then(run),
            get lastError() {
                return lastError;
            },
        };
        tasks.set(options.id, handle);
        return handle;
    }

    return {
        schedule,
        dispose() {
            disposed = true;
            for (const task of tasks.values()) task.stop();
        },
    };
}
