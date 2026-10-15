import { Module, type DynamicModule } from '@nestjs/common';
import type { AuthorizationRegistryOptions } from './authorization-definition.js';

export const AUTHORIZATION_OPTIONS = Symbol('permission.authorization.options');

/** Only configuration is global; ordinary PermissionModule imports keep their local providers. */
@Module({})
export class PermissionConfigurationModule {
    static forRoot(options: AuthorizationRegistryOptions): DynamicModule {
        return {
            module: PermissionConfigurationModule,
            global: true,
            providers: [{ provide: AUTHORIZATION_OPTIONS, useValue: options }],
            exports: [AUTHORIZATION_OPTIONS],
        };
    }
}
