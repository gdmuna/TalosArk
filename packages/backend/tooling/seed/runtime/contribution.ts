import type { FactoryProvider, ModuleMetadata, Provider, Type } from '@nestjs/common';
import type { z } from 'zod';
import type { SeederKind } from '../definition/dataset.js';
import { SeedServices, type BusinessSeeder } from './handler.js';

export interface SeedHandlerBinding {
    register(services: SeedServices): void;
}
export interface SeedHandlerRegistration {
    readonly token: symbol;
    readonly handler: Type<unknown>;
    readonly provider: FactoryProvider<SeedHandlerBinding>;
}
export interface SeedRuntimeDefinition {
    readonly imports?: ModuleMetadata['imports'];
    readonly providers?: readonly Provider[];
    readonly handlers: readonly SeedHandlerRegistration[];
}
export function defineSeedRuntime(definition: SeedRuntimeDefinition): SeedRuntimeDefinition {
    return definition;
}
export function provideSeedHandler<K extends SeederKind>(
    kind: K,
    handler: Type<BusinessSeeder<NoInfer<K>>>,
    options: { actor?: (input: z.output<NoInfer<K>['input']>) => string } = {}
): SeedHandlerRegistration {
    const token = Symbol(`seed.handler.${kind.id}`);
    return {
        token,
        handler,
        provider: {
            provide: token,
            inject: [handler],
            useFactory: (instance: BusinessSeeder<K>) => ({
                register: (services) => {
                    services.register(kind, instance, options.actor);
                },
            }),
        },
    };
}
