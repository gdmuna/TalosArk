import { Inject, Injectable, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import {
    createExtensionIndex,
    type ExtensionEntry,
    type ExtensionIndex,
} from '@/platform/extensions/index.js';
import { ExtensionDiscovery } from '@/platform/extensions/discovery/index.js';
import { authorizationPoint } from './authorization-extension.decorator.js';
import {
    parseAuthorizationDefinition,
    parseAuthorizationMetadata,
    type AuthorizationDefinition,
    type AuthorizationRegistryOptions,
} from './authorization-definition.js';
import { PermissionError } from './permission.error.js';
import { AUTHORIZATION_OPTIONS } from './permission.configuration.js';

@Injectable()
export class AuthorizationRegistry implements OnApplicationBootstrap {
    private state: 'pending' | 'preparing' | 'ready' | 'failed' = 'pending';
    private index?: ExtensionIndex<ExtensionEntry<string, AuthorizationDefinition>>;

    constructor(
        private readonly discovery: ExtensionDiscovery,
        @Optional()
        @Inject(AUTHORIZATION_OPTIONS)
        private readonly options?: AuthorizationRegistryOptions
    ) {}

    onApplicationBootstrap(): void {
        if (!this.options) throw new PermissionError({ reason: 'missing-configuration' });
        this.initialize(this.options);
    }

    /** Lifecycle-owned publication; no consumer may read during module initialization. */
    private initialize(options: AuthorizationRegistryOptions): void {
        if (this.state !== 'pending') throw new PermissionError({ reason: 'already-initialized' });
        this.state = 'preparing';
        try {
            const entries: ExtensionEntry<string, AuthorizationDefinition>[] = (
                options.explicit ?? []
            ).map((entry) => {
                const value = parseAuthorizationDefinition(entry.value);
                if (entry.key !== value.code || entry.source.kind !== 'explicit')
                    throw new PermissionError({ reason: 'invalid-definition' });
                return { key: entry.key, value, source: entry.source };
            });
            if (options.discovery) {
                for (const { metadata, source } of this.discovery.collect(
                    authorizationPoint,
                    parseAuthorizationMetadata
                )) {
                    for (const value of metadata.definitions)
                        entries.push({ key: value.code, value, source });
                }
            }
            const index = createExtensionIndex(entries);
            for (const required of options.required ?? []) {
                const value = index.find(required.code);
                if (!value)
                    throw new PermissionError({
                        reason: 'missing-definition',
                        code: required.code,
                    });
                if (value.scope !== required.scope)
                    throw new PermissionError({ reason: 'scope-conflict', code: required.code });
            }
            this.index = index;
            this.state = 'ready';
        } catch (error) {
            this.state = 'failed';
            throw error;
        }
    }

    find(code: string): AuthorizationDefinition | undefined {
        if (this.state !== 'ready' || !this.index)
            throw new PermissionError({ reason: 'not-ready' });
        return this.index.find(code);
    }
}
