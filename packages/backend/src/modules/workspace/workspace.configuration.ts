import { Module, type DynamicModule } from '@nestjs/common';

export const WORKSPACE_MANAGER_PERMISSIONS = Symbol('workspace.manager.permissions');

@Module({})
export class WorkspaceConfigurationModule {
    static forRoot(initialManagerPermissions: readonly string[]): DynamicModule {
        return {
            module: WorkspaceConfigurationModule,
            global: true,
            providers: [
                {
                    provide: WORKSPACE_MANAGER_PERMISSIONS,
                    useValue: Object.freeze([...initialManagerPermissions]),
                },
            ],
            exports: [WORKSPACE_MANAGER_PERMISSIONS],
        };
    }
}
