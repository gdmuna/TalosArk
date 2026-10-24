import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import { z } from 'zod/v4';
import { IamError } from './iam.error.js';
import { validationDiagnostics } from '@/platform/error/error.validation.js';

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
    const parsed = optionsSchema.safeParse(input, { reportInput: true });
    if (!parsed.success)
        throw new IamError(
            { reason: 'configuration' },
            {
                validationIssues: validationDiagnostics(parsed.error, input, {
                    fields: {
                        endpoint: { label: 'endpoint (CASDOOR_ENDPOINT)' },
                        clientId: { label: 'clientId (CASDOOR_CLIENT_ID)' },
                        clientSecret: { label: 'clientSecret (CASDOOR_CLIENT_SECRET)' },
                        organization: { label: 'organization (CASDOOR_ORGANIZATION)' },
                        application: { label: 'application (CASDOOR_APPLICATION)' },
                        certificate: { label: 'certificate (CASDOOR_CERTIFICATE_PATH)' },
                        issuer: { label: 'issuer (CASDOOR_OIDC_ISSUER)' },
                        redirectUri: { label: 'redirectUri (CASDOOR_OIDC_REDIRECT_URI)' },
                    },
                }),
            }
        );
    return Object.freeze({
        ...parsed.data,
        endpoint: parsed.data.endpoint.replace(/\/+$/, ''),
    });
}
