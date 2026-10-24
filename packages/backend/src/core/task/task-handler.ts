import type { TaskContext, TaskValue } from './task.types.js';

export interface TaskHandler<T = unknown> {
    execute(payload: T, context: TaskContext): Promise<TaskValue | void>;
}
