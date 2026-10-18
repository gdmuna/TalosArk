import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { z } from 'zod';
import { ExtensionDiscovery } from '@/platform/extensions/discovery/index.js';
import {
    createExtensionIndex,
    type ExtensionEntry,
    type ExtensionIndex,
} from '@/platform/extensions/index.js';
import { resourcePoint } from './resource-extension.decorator.js';
import type { ResourceProvider } from './resource-provider.js';
import { ResourceError } from './resource.error.js';
import { RESOURCE_KINDS, type ResourceKind } from './resource-identity.js';
import { validationDiagnostics } from '@/platform/error/error.validation.js';

const metadata = z.strictObject({
    kind: z.enum(RESOURCE_KINDS),
});
type Entry = ExtensionEntry<string, ResourceProvider>;

function parseMetadata(input: unknown): { readonly kind: ResourceKind } {
    const result = metadata.safeParse(input, { reportInput: true });
    if (!result.success)
        throw new ResourceError(
            { reason: 'invalid-provider' },
            { validationIssues: validationDiagnostics(result.error, input) }
        );
    return result.data;
}

@Injectable()
export class ResourceProviderRegistry implements OnApplicationBootstrap {
    private state: 'pending' | 'preparing' | 'ready' | 'failed' = 'pending';
    private index?: ExtensionIndex<Entry>;
    constructor(private readonly discovery: ExtensionDiscovery) {}

    onApplicationBootstrap(): void {
        if (this.state !== 'pending') throw new ResourceError({ reason: 'already-initialized' });
        this.state = 'preparing';
        try {
            const entries: Entry[] = this.discovery
                .collect(resourcePoint, parseMetadata)
                .map((entry) => {
                    if (entry.target.kind !== 'provider')
                        throw new ResourceError({ reason: 'invalid-provider' });
                    const provider = entry.target.instance as Partial<ResourceProvider>;
                    if (typeof provider.describe !== 'function')
                        throw new ResourceError({ reason: 'invalid-provider' });
                    return {
                        key: entry.metadata.kind,
                        value: Object.freeze({ describe: provider.describe.bind(provider) }),
                        source: entry.source,
                    };
                });
            this.index = createExtensionIndex(entries);
            this.state = 'ready';
        } catch (error) {
            this.state = 'failed';
            throw error;
        }
    }

    require(kind: ResourceKind): ResourceProvider {
        if (this.state !== 'ready' || !this.index) throw new ResourceError({ reason: 'not-ready' });
        const provider = this.index.find(kind);
        if (!provider) throw new ResourceError({ reason: 'missing-provider' });
        return provider;
    }
}
