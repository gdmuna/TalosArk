import { Injectable, Scope, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { ExtensionPoint, ExtensionSource } from '../extension.contract.js';
import { ExtensionError } from '../extension.error.js';
import { snapshotExtensionSource } from '../extension-index.js';
import { EXTENSION_DECLARATIONS, EXTENSION_MARKER } from './extension.decorator.js';

export interface DiscoveredExtension<M> {
    readonly metadata: M;
    readonly source: ExtensionSource;
    readonly target:
        | { readonly kind: 'provider'; readonly instance: unknown }
        | { readonly kind: 'method'; readonly invoke: (...args: unknown[]) => unknown };
}

interface Candidate {
    readonly metadata: unknown;
    readonly source: ExtensionSource;
    readonly resolveTarget: () => DiscoveredExtension<unknown>['target'];
}

@Injectable()
export class ExtensionDiscovery implements OnApplicationBootstrap {
    private ready = false;
    private candidates?: ReadonlyMap<symbol, readonly Candidate[]>;

    constructor(private readonly discovery: DiscoveryService) {}

    onApplicationBootstrap(): void {
        this.ready = true;
    }

    collect<M>(
        point: ExtensionPoint<M>,
        parseMetadata: (input: unknown) => NoInfer<M>
    ): readonly DiscoveredExtension<M>[] {
        if (!this.ready) throw new ExtensionError({ reason: 'not-ready', point: point.name });
        this.candidates ??= this.snapshot();
        return Object.freeze(
            (this.candidates.get(point.metadataKey) ?? []).map((candidate) =>
                Object.freeze({
                    source: candidate.source,
                    target: candidate.resolveTarget(),
                    metadata: parseMetadata(candidate.metadata),
                })
            )
        );
    }

    private snapshot(): ReadonlyMap<symbol, readonly Candidate[]> {
        const candidates = new Map<symbol, Candidate[]>();
        for (const wrapper of this.discovery.getProviders()) {
            if (wrapper.isAlias) continue;
            const instance: unknown = wrapper.instance;
            const actual =
                instance && typeof instance === 'object'
                    ? Object.getPrototypeOf(instance)?.constructor
                    : undefined;
            const ctor =
                typeof actual === 'function' && Reflect.getOwnMetadata(EXTENSION_MARKER, actual)
                    ? actual
                    : wrapper.metatype;
            if (typeof ctor !== 'function' || !Reflect.getOwnMetadata(EXTENSION_MARKER, ctor))
                continue;
            const base = {
                owner: wrapper.host?.metatype.name ?? 'anonymous-module',
                provider: ctor.name || 'anonymous-provider',
            };
            const source = snapshotExtensionSource({ kind: 'provider', ...base });
            // Scope checks belong to the selected point, not unrelated disabled hosts.
            const resolveInstance = () => {
                if (
                    (wrapper.scope ?? Scope.DEFAULT) !== Scope.DEFAULT ||
                    !wrapper.isDependencyTreeStatic()
                )
                    throw new ExtensionError({ reason: 'discovery-scope', sources: [source] });
                if (!instance || typeof instance !== 'object')
                    throw new ExtensionError({ reason: 'target-unavailable', sources: [source] });
                return instance;
            };
            const add = (target: object, candidate: Omit<Candidate, 'metadata'>) => {
                const keys = (Reflect.getOwnMetadata(EXTENSION_DECLARATIONS, target) ??
                    []) as readonly symbol[];
                for (const key of keys) {
                    const entries = candidates.get(key) ?? [];
                    entries.push(
                        Object.freeze({
                            ...candidate,
                            metadata: Reflect.getOwnMetadata(key, target),
                        })
                    );
                    candidates.set(key, entries);
                }
            };
            add(ctor, {
                source,
                resolveTarget: () =>
                    Object.freeze({ kind: 'provider', instance: resolveInstance() }),
            });
            const prototype = ctor.prototype as object | undefined;
            if (!prototype) continue;
            for (const method of Object.getOwnPropertyNames(prototype)) {
                if (method === 'constructor') continue;
                const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
                if (typeof descriptor?.value !== 'function') continue;
                const fn = descriptor.value as (...args: unknown[]) => unknown;
                add(fn, {
                    source: snapshotExtensionSource({ kind: 'method', ...base, method }),
                    resolveTarget: () => {
                        const instance = resolveInstance();
                        const own = Object.getOwnPropertyDescriptor(instance, method);
                        const callable: unknown = own ? own.value : fn;
                        if (typeof callable !== 'function')
                            throw new ExtensionError({
                                reason: 'target-unavailable',
                                sources: [source],
                            });
                        return Object.freeze({
                            kind: 'method',
                            invoke: (callable as (...args: unknown[]) => unknown).bind(instance),
                        });
                    },
                });
            }
        }
        return new Map([...candidates].map(([key, entries]) => [key, Object.freeze(entries)]));
    }
}
