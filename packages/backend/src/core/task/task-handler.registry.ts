import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ExtensionDiscovery } from '@/platform/extensions/discovery/index.js';
import { taskHandlerPoint } from './task-handler.decorator.js';
import type { TaskDefinition } from './task.types.js';
import type { TaskHandler } from './task-handler.js';
import { TaskError } from './task.error.js';
import { policySchema } from './internal/task.input.js';

export interface RegisteredTask {
    readonly definition: TaskDefinition;
    readonly handler: TaskHandler;
}
const key = (kind: string, version: number) => `${kind}@${version}`;

@Injectable()
export class TaskHandlerRegistry {
    private entries?: ReadonlyMap<string, RegisteredTask>;
    constructor(private readonly discovery: ExtensionDiscovery) {}

    initialize(): void {
        if (this.entries) return;
        const entries = new Map<string, RegisteredTask>();
        const schema = z.object({
            kind: z
                .string()
                .max(100)
                .regex(/^[a-z][a-z0-9_.-]+$/),
            version: z.number().int().min(1),
            policy: policySchema,
        });
        for (const entry of this.discovery.collect(
            taskHandlerPoint,
            (value) => value as TaskDefinition
        )) {
            const definition = entry.metadata;
            const parsed = schema.safeParse(definition);
            if (
                !parsed.success ||
                typeof definition.input?.parse !== 'function' ||
                entry.target.kind !== 'provider'
            )
                throw new TaskError({ reason: 'invalid-handler' });
            const handler = entry.target.instance as TaskHandler;
            if (
                typeof handler.execute !== 'function' ||
                entries.has(key(definition.kind, definition.version))
            )
                throw new TaskError({ reason: 'invalid-handler' });
            entries.set(
                key(definition.kind, definition.version),
                Object.freeze({
                    definition: Object.freeze({
                        ...parsed.data,
                        input: definition.input,
                        policy: Object.freeze({
                            ...parsed.data.policy,
                            backoff: Object.freeze(parsed.data.policy.backoff),
                        }),
                    }),
                    handler: Object.freeze({ execute: handler.execute.bind(handler) }),
                })
            );
        }
        this.entries = entries;
    }

    require(kind: string, version: number): RegisteredTask {
        if (!this.entries) throw new TaskError({ reason: 'not-ready' });
        const entry = this.entries.get(key(kind, version));
        if (!entry) throw new TaskError({ reason: 'unknown-handler' });
        return entry;
    }
}
