import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';

export interface S3ProviderOptions {
    endpoint: string;
    region?: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
    /** Path-prefix URL; Storage appends /bucket/key, without granting public access. */
    publicBaseUrl?: string;
}

export interface StorageModuleOptions {
    options: S3ProviderOptions;
    imports?: ModuleMetadata['imports'];
}

export interface StorageModuleAsyncOptions {
    useFactory: FactoryProvider<StorageModuleOptions>['useFactory'];
    imports?: ModuleMetadata['imports'];
    inject?: FactoryProvider<StorageModuleOptions>['inject'];
}
