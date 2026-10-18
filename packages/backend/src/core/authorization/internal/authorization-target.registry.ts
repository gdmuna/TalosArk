import { Inject, Injectable, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import {
    createExtensionIndex,
    type ExtensionEntry,
    type ExtensionIndex,
} from '@/platform/extensions/index.js';
import { ExtensionDiscovery } from '@/platform/extensions/discovery/index.js';
import { AUTHORIZATION_TARGET_OPTIONS } from '../authorization.configuration.js';
import { authorizationTargetPoint } from '../authorization-target-extension.decorator.js';
import { AuthorizationTargetError } from '../authorization-target.error.js';
import type {
    AuthorizationTargetOptions,
    AuthorizationTargetProvider,
} from '../authorization-target.provider.js';
import { parseTargetMetadata } from './authorization.input.js';

type TargetEntry = ExtensionEntry<string, AuthorizationTargetProvider>;

@Injectable()
export class AuthorizationTargetRegistry implements OnApplicationBootstrap {
    private state: 'pending' | 'preparing' | 'ready' | 'failed' = 'pending';
    private index?: ExtensionIndex<TargetEntry>;

    constructor(
        private readonly discovery: ExtensionDiscovery,
        @Optional()
        @Inject(AUTHORIZATION_TARGET_OPTIONS)
        private readonly options?: AuthorizationTargetOptions
    ) {}

    onApplicationBootstrap(): void {
        if (this.state !== 'pending')
            throw new AuthorizationTargetError({ reason: 'already-initialized' });
        this.state = 'preparing';
        try {
            const entries: TargetEntry[] = (this.options?.explicit ?? []).map((entry) => {
                if (entry.source.kind !== 'explicit')
                    throw new AuthorizationTargetError({ reason: 'invalid-provider' });
                return {
                    ...entry,
                    value: this.snapshot(entry.key, entry.value),
                };
            });
            if (this.options?.discovery !== false) {
                for (const entry of this.discovery.collect(
                    authorizationTargetPoint,
                    parseTargetMetadata
                )) {
                    if (entry.target.kind !== 'provider')
                        throw new AuthorizationTargetError({
                            reason: 'invalid-provider',
                            kind: entry.metadata.kind,
                        });
                    entries.push({
                        key: entry.metadata.kind,
                        value: this.snapshot(entry.metadata.kind, entry.target.instance),
                        source: entry.source,
                    });
                }
            }
            const index = createExtensionIndex(entries);
            for (const kind of this.options?.required ?? []) {
                parseTargetMetadata({ kind });
                if (!index.find(kind))
                    throw new AuthorizationTargetError({ reason: 'missing-provider', kind });
            }
            this.index = index;
            this.state = 'ready';
        } catch (error) {
            this.state = 'failed';
            throw error;
        }
    }

    require(kind: string): AuthorizationTargetProvider {
        if (this.state !== 'ready' || !this.index)
            throw new AuthorizationTargetError({ reason: 'not-ready' });
        const provider = this.index.find(kind);
        if (!provider) throw new AuthorizationTargetError({ reason: 'missing-provider', kind });
        return provider;
    }

    private snapshot(kind: string, input: unknown): AuthorizationTargetProvider {
        parseTargetMetadata({ kind });
        if (
            !input ||
            typeof input !== 'object' ||
            !('resolve' in input) ||
            typeof input.resolve !== 'function'
        )
            throw new AuthorizationTargetError({ reason: 'invalid-provider', kind });
        const provider = input as AuthorizationTargetProvider;
        return Object.freeze({ resolve: provider.resolve.bind(provider) });
    }
}
