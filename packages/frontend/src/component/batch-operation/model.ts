import { onScopeDispose, ref, shallowRef, watch } from 'vue';
import { z } from 'zod';

export const batchLimit = 100;
export type BatchStatus = 'pending' | 'unknown' | 'failed' | 'succeeded' | 'skipped';
export type BatchRow = { id: string; label: string; status: BatchStatus; error: string };

export function createCommandBatch<Input, Result>(options: {
    key: string;
    input: z.ZodType<Input>;
    result: z.ZodType<Result>;
    activeScope: () => string;
    scopeOf: (input: Input) => string;
    canStart: () => boolean;
    send: (input: Input, signal: AbortSignal) => Promise<Result>;
    verify: (input: Input, result: Result, signal: AbortSignal) => Promise<Result>;
    message: (cause: unknown) => string;
    isRejection: (cause: unknown) => boolean;
}) {
    const itemSchema = z.object({
        id: z.uuid(),
        label: z.string().min(1).max(1000),
        input: options.input,
        status: z.enum(['pending', 'unknown', 'failed', 'succeeded', 'skipped']),
        error: z.string(),
        result: options.result.optional(),
    });
    const batchSchema = z.object({
        id: z.uuid(),
        scope: z.string().min(1),
        title: z.string().min(1),
        items: z.array(itemSchema).min(1).max(batchLimit),
        synchronized: z.boolean(),
        syncError: z.string().default(''),
    });
    type Batch = z.infer<typeof batchSchema>;
    type Item = z.infer<typeof itemSchema>;
    const batches = shallowRef<Batch[]>([]);
    const busy = ref(false),
        error = ref('');
    let owner: string | undefined,
        storageOwner = '',
        request: AbortController | undefined;
    const current = (scope: string) => batches.value.find((batch) => batch.scope === scope);
    const storageKey = () => `talos.batch.${options.key}.${storageOwner}`;
    function persist() {
        try {
            sessionStorage.setItem(storageKey(), JSON.stringify(batches.value));
            error.value = '';
            return true;
        } catch {
            error.value = '无法保存批次恢复信息，请核对原操作后重试';
            return false;
        }
    }
    function pause() {
        request?.abort();
        request = undefined;
        busy.value = false;
    }
    function connect(userId?: string) {
        if (owner === userId) return;
        pause();
        if (storageOwner && (userId === '' || (userId && userId !== storageOwner))) {
            try {
                sessionStorage.removeItem(storageKey());
            } catch {
                /* Memory is cleared below. */
            }
        }
        owner = userId;
        if (userId !== undefined) storageOwner = userId;
        batches.value = [];
        error.value = '';
        if (!owner) return;
        try {
            const saved = sessionStorage.getItem(storageKey());
            if (saved) {
                const parsed = z.array(batchSchema).parse(JSON.parse(saved));
                if (
                    new Set(parsed.map((batch) => batch.scope)).size !== parsed.length ||
                    parsed.some(
                        (batch) =>
                            new Set(batch.items.map((item) => item.id)).size !==
                                batch.items.length ||
                            batch.items.some(
                                (item) =>
                                    (item.status === 'succeeded' && !item.result) ||
                                    options.scopeOf(item.input) !== batch.scope
                            )
                    )
                )
                    throw new Error('Invalid batch journal');
                batches.value = parsed;
            }
        } catch {
            error.value = '批次恢复信息无法读取，请先核对原操作，勿重复提交';
        }
    }
    function create(
        scope: string,
        title: string,
        items: { id: string; label: string; input: Input }[]
    ) {
        if (
            !owner ||
            busy.value ||
            error.value ||
            current(scope) ||
            scope !== options.activeScope() ||
            !options.canStart()
        )
            return false;
        if (
            new Set(items.map((item) => item.id)).size !== items.length ||
            items.some((item) => options.scopeOf(item.input) !== scope)
        )
            return false;
        const batch = batchSchema.parse({
            id: crypto.randomUUID(),
            scope,
            title,
            items: items.map((item) => ({ ...item, status: 'pending', error: '' })),
            synchronized: false,
            syncError: '',
        });
        batches.value = [...batches.value, batch];
        return persist();
    }
    function replace(scope: string, update: (batch: Batch) => Batch) {
        batches.value = batches.value.map((batch) =>
            batch.scope === scope ? update(batch) : batch
        );
    }
    function update(scope: string, id: string, patch: Partial<Item>) {
        replace(scope, (batch) => ({
            ...batch,
            synchronized: false,
            items: batch.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        }));
    }
    async function run(scope: string, retryFailed = false) {
        if (
            !owner ||
            busy.value ||
            !options.canStart() ||
            scope !== options.activeScope() ||
            !current(scope) ||
            !persist()
        )
            return;
        const controller = new AbortController();
        request = controller;
        busy.value = true;
        try {
            if (retryFailed) {
                replace(scope, (batch) => ({
                    ...batch,
                    items: batch.items.map((item) =>
                        item.status === 'failed' ? { ...item, status: 'pending', error: '' } : item
                    ),
                }));
            }
            for (const item of current(scope)?.items ?? []) {
                if (controller.signal.aborted) return;
                if (item.status !== 'pending' && item.status !== 'unknown') continue;
                const recovering = item.status === 'unknown';
                // Persist uncertainty before sending; a reload cannot turn an in-flight write into a new intent.
                update(scope, item.id, { status: 'unknown', error: '' });
                if (!persist()) return;
                try {
                    const result = await options.send(item.input, controller.signal);
                    if (controller.signal.aborted) return;
                    update(scope, item.id, { status: 'succeeded', result, error: '' });
                } catch (cause) {
                    if (controller.signal.aborted) return;
                    const rejected = !recovering && options.isRejection(cause);
                    update(scope, item.id, {
                        status: rejected ? 'failed' : 'unknown',
                        error: options.message(cause),
                    });
                    if (!persist() || !rejected) return;
                }
                if (!persist()) return;
            }
        } finally {
            if (request === controller) {
                request = undefined;
                busy.value = false;
            }
        }
    }
    async function synchronize(scope: string, reload: () => Promise<boolean>) {
        const batch = current(scope);
        if (
            !owner ||
            busy.value ||
            !options.canStart() ||
            scope !== options.activeScope() ||
            !batch
        )
            return false;
        const controller = new AbortController();
        request = controller;
        busy.value = true;
        replace(scope, (batch) => ({ ...batch, synchronized: false, syncError: '' }));
        try {
            for (const item of batch.items) {
                if (item.status !== 'succeeded' || !item.result) continue;
                await options.verify(item.input, item.result, controller.signal);
                if (controller.signal.aborted) return false;
            }
            if (controller.signal.aborted || !(await reload()) || controller.signal.aborted)
                return false;
            replace(scope, (batch) => ({ ...batch, synchronized: true }));
            return persist();
        } catch (cause) {
            if (!controller.signal.aborted)
                replace(scope, (batch) => ({ ...batch, syncError: options.message(cause) }));
            return false;
        } finally {
            if (request === controller) {
                request = undefined;
                busy.value = false;
            }
        }
    }
    function skipPending(scope: string) {
        if (busy.value || scope !== options.activeScope()) return;
        replace(scope, (batch) => ({
            ...batch,
            items: batch.items.map((item) =>
                item.status === 'pending' ? { ...item, status: 'skipped' } : item
            ),
        }));
        persist();
    }
    function finish(scope: string) {
        const batch = current(scope);
        if (
            busy.value ||
            !batch ||
            scope !== options.activeScope() ||
            batch.items.some((item) => item.status === 'unknown' || item.status === 'pending') ||
            (batch.items.some((item) => item.status === 'succeeded') && !batch.synchronized)
        )
            return false;
        const previous = batches.value;
        batches.value = previous.filter((item) => item !== batch);
        if (persist()) return true;
        batches.value = previous;
        return false;
    }
    watch(options.activeScope, pause, { flush: 'sync' });
    onScopeDispose(pause);
    return {
        current,
        connect,
        create,
        run,
        synchronize,
        skipPending,
        finish,
        pause,
        get busy() {
            return busy.value;
        },
        get error() {
            return error.value;
        },
    };
}
