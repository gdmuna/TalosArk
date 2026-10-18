import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { FILE_OPTIONS, type ResolvedFileOptions } from '../file.options.js';
import { FileError } from '../file.error.js';

@Injectable()
export class FileOperations implements OnModuleDestroy {
    private readonly active = new Set<AbortController>();
    private readonly pending = new Set<Promise<unknown>>();
    private stopping = false;

    constructor(@Inject(FILE_OPTIONS) private readonly options: ResolvedFileOptions) {}

    async run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
        if (this.stopping) throw new FileError({ reason: 'stopping' });
        if (this.active.size >= this.options.maxConcurrentOperations)
            throw new FileError({ reason: 'busy' });
        const controller = new AbortController();
        this.active.add(controller);
        const timer = setTimeout(
            () => controller.abort(new FileError({ reason: 'timeout' })),
            this.options.operationTimeoutMs
        );
        let onAbort = () => {};
        const aborted = new Promise<never>((_, reject) => {
            onAbort = () => reject(controller.signal.reason);
            controller.signal.addEventListener('abort', onAbort, { once: true });
        });
        const running = Promise.resolve().then(() => {
            controller.signal.throwIfAborted();
            return work(controller.signal);
        });
        this.pending.add(running);
        // Timed-out work retains its capacity slot until the underlying operation actually settles.
        void running.then(
            () => {
                this.active.delete(controller);
                this.pending.delete(running);
            },
            () => {
                this.active.delete(controller);
                this.pending.delete(running);
            }
        );
        try {
            return await Promise.race([running, aborted]);
        } finally {
            clearTimeout(timer);
            controller.signal.removeEventListener('abort', onAbort);
        }
    }

    async onModuleDestroy(): Promise<void> {
        this.stopping = true;
        for (const controller of this.active)
            controller.abort(new FileError({ reason: 'stopping' }));
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([
                Promise.allSettled([...this.pending]),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(
                        () => reject(new FileError({ reason: 'close-timeout' })),
                        this.options.closeTimeoutMs
                    );
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }
}
