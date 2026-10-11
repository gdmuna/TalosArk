import { Injectable, type OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class HealthState implements OnModuleDestroy {
    private state: 'starting' | 'ready' | 'stopping' = 'starting';

    get isReady(): boolean {
        return this.state === 'ready';
    }

    markReady(): void {
        if (this.state === 'starting') this.state = 'ready';
    }

    beginShutdown(): void {
        this.state = 'stopping';
    }

    onModuleDestroy(): void {
        this.beginShutdown();
    }
}
