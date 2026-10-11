import { createSdkAxiosAdapter } from './axios.transport.js';
import { createCredentialGate, type CredentialGateOptions } from './credential-gate.js';
import { createHttpClient } from './http-client.js';
import type { HttpClientOptions } from './type.js';

import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class HttpClientFactory implements OnModuleDestroy {
    private readonly resources = new Set<{ dispose(): void }>();
    private disposed = false;

    constructor(@InjectPinoLogger(HttpClientFactory.name) private readonly logger: PinoLogger) {}

    create(options: HttpClientOptions) {
        this.assertActive();
        return this.own(
            createHttpClient(options, (observation) =>
                this.logger.debug(
                    { ...observation, event: 'http.outbound.completed' },
                    'Outbound HTTP execution'
                )
            )
        );
    }

    createAxiosAdapter(options: HttpClientOptions) {
        return createSdkAxiosAdapter(this.create(options), options.baseUrl);
    }

    createCredentialGate(options: CredentialGateOptions) {
        this.assertActive();
        return this.own(createCredentialGate(options));
    }

    onModuleDestroy() {
        this.disposed = true;
        for (const resource of this.resources) resource.dispose();
    }

    private own<T extends { dispose(): void }>(resource: T): T {
        const dispose = resource.dispose.bind(resource);
        resource.dispose = () => {
            dispose();
            this.resources.delete(resource);
        };
        this.resources.add(resource);
        return resource;
    }

    private assertActive() {
        if (this.disposed) throw new Error('HTTP client factory is disposed');
    }
}
