import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { AlsContextAdapter } from '@/platform/context/als-context.adapter.js';
import { PlatformContextModule } from '@/platform/context/context.module.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { AuditModule } from '@/core/audit/index.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { PermissionModule, PermissionConfigurationModule } from '@/core/permission/index.js';
import { WorkspaceConfigurationModule } from '@/modules/workspace/workspace.configuration.js';
import { OrganizationWriteModule } from '@/core/organization-write/index.js';
import { inventoryConfig } from '@/config/inventory.config.js';
import type { StorageConfig } from '@/config/storage.config.js';
import { SeedSecrets } from '@root/tooling/seed/runtime/secret.js';
import { SeedRunner } from '@root/tooling/seed/runtime/runner.js';
import { SeedServices } from '@root/tooling/seed/runtime/handler.js';
import type {
    SeedHandlerBinding,
    SeedRuntimeDefinition,
} from '@root/tooling/seed/runtime/contribution.js';
import type { SeedProgram } from '@root/tooling/seed/plan/planner.js';
import { PreparedFixtures } from '@root/tooling/seed/fixture/fixture.reader.js';
import { SeedStorageModule } from './seed-storage.module.js';
import { productAuthorizationEntries, workspaceManagerPermissions } from './product-policy.js';

@Module({})
export class SeedModule {
    static forRoot(options: {
        databaseUrl: string;
        definitions: readonly SeedRuntimeDefinition[];
        program: SeedProgram;
        fixtures: PreparedFixtures;
        secrets: SeedSecrets;
        storage?: StorageConfig;
    }): DynamicModule {
        const handlers = options.definitions.flatMap((definition) => definition.handlers);
        return {
            module: SeedModule,
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                    skipProcessEnv: true,
                    load: [
                        () => ({
                            database: { databaseUrl: options.databaseUrl },
                            identity: { passwordHashConcurrency: 2 },
                            team: { invitationTtlSeconds: 7 * 86400 },
                            observability: { slowQueryThreshold: { warn: 1000, error: 5000 } },
                        }),
                        inventoryConfig,
                    ],
                }),
                LoggerModule.forRoot({ pinoHttp: { level: 'warn', autoLogging: false } }),
                PermissionConfigurationModule.forRoot({
                    explicit: productAuthorizationEntries,
                    discovery: false,
                }),
                WorkspaceConfigurationModule.forRoot(workspaceManagerPermissions),
                DatabaseModule,
                PlatformContextModule,
                AuthorizationModule,
                AuditModule,
                OrganizationContextModule,
                PermissionModule,
                OrganizationWriteModule,
                ...options.definitions.flatMap((definition) => definition.imports ?? []),
                ...(options.storage ? [SeedStorageModule.forRoot(options.storage)] : []),
            ],
            providers: [
                { provide: SeedSecrets, useValue: options.secrets },
                { provide: PreparedFixtures, useValue: options.fixtures },
                ...options.definitions.flatMap((definition) => definition.providers ?? []),
                ...handlers.map((binding) => binding.handler),
                ...handlers.map((binding) => binding.provider),
                {
                    provide: SeedRunner,
                    inject: [
                        DatabaseRuntime,
                        AlsContextAdapter,
                        SeedSecrets,
                        ...handlers.map((binding) => binding.token),
                    ],
                    useFactory: (
                        database: DatabaseRuntime,
                        context: AlsContextAdapter,
                        secrets: SeedSecrets,
                        ...bindings: SeedHandlerBinding[]
                    ) => {
                        const services = new SeedServices();
                        for (const binding of bindings) binding.register(services);
                        services.require(options.program.steps);
                        return new SeedRunner(database, context, services, secrets);
                    },
                },
            ],
        };
    }
}
