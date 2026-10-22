import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { recordProcessReadiness } from '@/platform/observability/metrics/lifecycle.metric.js';

@Injectable()
export class HealthState implements OnModuleDestroy {
    private state: 'starting' | 'ready' | 'stopping' = 'starting';
    constructor() {
        recordProcessReadiness(false);
    }

    get isReady(): boolean {
        return this.state === 'ready';
    }

    markReady(): void {
        if (this.state === 'starting') {
            this.state = 'ready';
            recordProcessReadiness(true);
        }
    }

    beginShutdown(): void {
        recordProcessReadiness(false);
        this.state = 'stopping';
    }

    onModuleDestroy(): void {
        this.beginShutdown();
    }
}
