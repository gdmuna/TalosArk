import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import { z } from 'zod/v4';
import { IamError } from './iam.error.js';

export interface CasdoorIamOptions {
    endpoint: string;
    clientId: string;
    clientSecret: string;
    organization: string;
    application?: string;
    certificate: string;
    issuer: string;
    redirectUri: string;
}

export interface IamModuleOptions {
    options: CasdoorIamOptions;
    imports?: ModuleMetadata['imports'];
}

export interface IamModuleAsyncOptions {
    imports?: ModuleMetadata['imports'];
    inject?: FactoryProvider<IamModuleOptions>['inject'];
    useFactory: FactoryProvider<IamModuleOptions>['useFactory'];
}

const optionsSchema = z.object({
    endpoint: z.url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    organization: z.string().min(1),
    application: z.string().min(1).optional(),
    certificate: z.string().min(1),
    issuer: z.url(),
    redirectUri: z.url(),
});

export function resolveIamOptions(input: CasdoorIamOptions): Readonly<CasdoorIamOptions> {
    const parsed = optionsSchema.safeParse(input);
    if (!parsed.success) throw new IamError({ reason: 'configuration' });
    return Object.freeze({
        ...parsed.data,
        endpoint: parsed.data.endpoint.replace(/\/+$/, ''),
    });
}
