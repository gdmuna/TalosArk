import { Module, type DynamicModule } from '@nestjs/common';
import type { AuthorizationTargetOptions } from './authorization-target.provider.js';

export const AUTHORIZATION_TARGET_OPTIONS = Symbol('authorization.target.options');

/** Optional composition configuration; AuthorizationModule retains its ordinary imports. */
@Module({})
export class AuthorizationConfigurationModule {
    static forRoot(options: AuthorizationTargetOptions): DynamicModule {
        return {
            module: AuthorizationConfigurationModule,
            global: true,
            providers: [{ provide: AUTHORIZATION_TARGET_OPTIONS, useValue: options }],
            exports: [AUTHORIZATION_TARGET_OPTIONS],
        };
    }
}
