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
import {
    organizationAuthorizationEntries,
    workspacePermission,
} from '@/core/team-governance/index.js';
import { WorkspaceModule } from '@/modules/workspace/workspace.module.js';
import { WorkspaceConfigurationModule } from '@/modules/workspace/workspace.configuration.js';
import { OrganizationService } from '@/modules/organization/application/organization.service.js';
import { MaterialCatalogModule } from '@/modules/material/material-catalog.module.js';
import { FacilityModule } from '@/modules/facility/facility.module.js';
import { InventoryModule } from '@/modules/inventory/inventory.module.js';
import { ApprovalModule } from '@/modules/approval/approval.module.js';
import { approvalPermission } from '@/modules/approval/contribution/approval-authorization.contribution.js';
import { TeamGovernanceModule } from '@/core/team-governance/index.js';
import { OrganizationWriteModule } from '@/core/organization-write/index.js';
import { IdentityCredentialModule } from '@/core/identity/identity-credential.module.js';
import { OrganizationTeamService } from '@/modules/organization/application/team.service.js';
import { TeamOperations } from '@/modules/organization/application/team.operations.js';
import { OrganizationInvitationService } from '@/modules/organization/application/invitation.service.js';
import { INVITATION_DELIVERY } from '@/modules/organization/application/invitation-delivery.port.js';
import { SeedSecrets } from '@root/tooling/seed/seed.secret.js';
import { AccountSeeder } from '@root/tooling/seed/seeder/account.seeder.js';
import {
    TeamSeeder,
    ExtraWorkspaceSeeder,
    WorkspaceMembershipSeeder,
} from '@root/tooling/seed/seeder/governance.seeder.js';
import { accountsKind } from '@root/tooling/seed/seeder/account.kind.js';
import {
    teamKind,
    extraWorkspaceKind,
    workspaceMembershipKind,
} from '@root/tooling/seed/seeder/governance.kind.js';
import { batchKind } from '@root/tooling/seed/seeder/batch.kind.js';
import { BatchSeeder } from '@root/tooling/seed/seeder/batch.seeder.js';
import { inventoryHistoryKind } from '@root/tooling/seed/seeder/inventory-history.kind.js';
import { InventoryHistorySeeder } from '@root/tooling/seed/seeder/inventory-history.seeder.js';
import { approvalKind } from '@root/tooling/seed/seeder/approval.kind.js';
import { ApprovalSeeder } from '@root/tooling/seed/seeder/approval.seeder.js';
import { facilityLifecycleKind } from '@root/tooling/seed/seeder/facility-lifecycle.kind.js';
import { FacilityLifecycleSeeder } from '@root/tooling/seed/seeder/facility-lifecycle.seeder.js';
import { credentialKind } from '@root/tooling/seed/seeder/credential.kind.js';
import { CredentialSeeder } from '@root/tooling/seed/seeder/credential.seeder.js';
import { AttachmentSeeder } from '@root/tooling/seed/seeder/attachment.seeder.js';
import { attachmentKind } from '@root/tooling/seed/seeder/attachment.kind.js';
import type { StorageConfig } from '@/config/storage.config.js';
import { SeedStorageModule } from './seed-storage.module.js';
import { materialPermission } from '@/modules/material/contribution/material-authorization.contribution.js';
import { facilityPermission } from '@/modules/facility/contribution/facility-authorization.contribution.js';
import { inventoryPermission } from '@/modules/inventory/contribution/inventory-authorization.contribution.js';
import { inventoryConfig } from '@/config/inventory.config.js';
import { WorkspaceSeeder } from '@root/tooling/seed/seeder/workspace.seeder.js';
import { MaterialSeeder } from '@root/tooling/seed/seeder/material.seeder.js';
import { FacilitySeeder } from '@root/tooling/seed/seeder/facility.seeder.js';
import { ReceiptSeeder } from '@root/tooling/seed/seeder/receipt.seeder.js';
import { SeedRunner } from '@root/tooling/seed/seed.runner.js';
import { SeedServices } from '@root/tooling/seed/seed.definition.js';
import {
    workspaceKind,
    materialKind,
    facilityKind,
    receiptKind,
} from '@root/tooling/seed/seeder/seed.kind.js';

@Module({})
export class SeedModule {
    static forRoot(databaseUrl: string, storage?: StorageConfig): DynamicModule {
        return {
            module: SeedModule,
            imports: [
                // Tool configuration is explicit and independent of unrelated runtime secrets.
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                    skipProcessEnv: true,
                    load: [
                        () => ({
                            database: { databaseUrl },
                            identity: { passwordHashConcurrency: 2 },
                            team: { invitationTtlSeconds: 7 * 86400 },
                            observability: { slowQueryThreshold: { warn: 1000, error: 5000 } },
                        }),
                        inventoryConfig,
                    ],
                }),
                LoggerModule.forRoot({ pinoHttp: { level: 'warn', autoLogging: false } }),
                PermissionConfigurationModule.forRoot({
                    explicit: organizationAuthorizationEntries,
                    discovery: true,
                }),
                WorkspaceConfigurationModule.forRoot([
                    ...Object.values(workspacePermission).filter(
                        (code) => code !== workspacePermission.create
                    ),
                    ...Object.values(materialPermission),
                    ...Object.values(inventoryPermission),
                    ...Object.values(approvalPermission),
                    facilityPermission.read,
                    facilityPermission.use,
                    facilityPermission.manage,
                ]),
                DatabaseModule,
                PlatformContextModule,
                AuthorizationModule,
                AuditModule,
                OrganizationContextModule,
                PermissionModule,
                WorkspaceModule,
                MaterialCatalogModule,
                FacilityModule,
                InventoryModule,
                ApprovalModule,
                IdentityCredentialModule,
                TeamGovernanceModule,
                OrganizationWriteModule,
                ...(storage ? [SeedStorageModule.forRoot(storage)] : []),
            ],
            providers: [
                OrganizationService,
                WorkspaceSeeder,
                MaterialSeeder,
                FacilitySeeder,
                ReceiptSeeder,
                AccountSeeder,
                ExtraWorkspaceSeeder,
                TeamSeeder,
                WorkspaceMembershipSeeder,
                BatchSeeder,
                InventoryHistorySeeder,
                ApprovalSeeder,
                FacilityLifecycleSeeder,
                CredentialSeeder,
                OrganizationTeamService,
                OrganizationInvitationService,
                TeamOperations,
                SeedSecrets,
                { provide: INVITATION_DELIVERY, useExisting: SeedSecrets },
                {
                    provide: SeedRunner,
                    inject: [
                        DatabaseRuntime,
                        AlsContextAdapter,
                        WorkspaceSeeder,
                        MaterialSeeder,
                        FacilitySeeder,
                        ReceiptSeeder,
                        AccountSeeder,
                        ExtraWorkspaceSeeder,
                        TeamSeeder,
                        WorkspaceMembershipSeeder,
                        BatchSeeder,
                        InventoryHistorySeeder,
                        ApprovalSeeder,
                        FacilityLifecycleSeeder,
                        CredentialSeeder,
                        { token: AttachmentSeeder, optional: true },
                    ],
                    useFactory: (
                        database: DatabaseRuntime,
                        context: AlsContextAdapter,
                        workspace: WorkspaceSeeder,
                        material: MaterialSeeder,
                        facility: FacilitySeeder,
                        receipt: ReceiptSeeder,
                        account: AccountSeeder,
                        extraWorkspace: ExtraWorkspaceSeeder,
                        team: TeamSeeder,
                        membership: WorkspaceMembershipSeeder,
                        batch: BatchSeeder,
                        history: InventoryHistorySeeder,
                        approval: ApprovalSeeder,
                        facilityLifecycle: FacilityLifecycleSeeder,
                        credential: CredentialSeeder,
                        attachment?: AttachmentSeeder
                    ) => {
                        const services = new SeedServices()
                            .register(workspaceKind, workspace, (input) => input.actorUserId)
                            .register(materialKind, material, (input) => input.actorUserId)
                            .register(facilityKind, facility, (input) => input.actorUserId)
                            .register(
                                receiptKind,
                                receipt,
                                (input) => input.materials.scope.actorUserId
                            )
                            .register(accountsKind, account)
                            .register(
                                extraWorkspaceKind,
                                extraWorkspace,
                                (input) => input.actorUserId
                            )
                            .register(teamKind, team, (input) => input.scope.actorUserId)
                            .register(
                                workspaceMembershipKind,
                                membership,
                                (input) => input.scope.actorUserId
                            )
                            .register(batchKind, batch, (input) => input.scope.actorUserId)
                            .register(
                                inventoryHistoryKind,
                                history,
                                (input) => input.receipt.scope.actorUserId
                            )
                            .register(
                                approvalKind,
                                approval,
                                (input) => input.receipt.scope.actorUserId
                            )
                            .register(
                                facilityLifecycleKind,
                                facilityLifecycle,
                                (input) => input.facility.scope.actorUserId
                            )
                            .register(credentialKind, credential);
                        if (attachment)
                            services.register(
                                attachmentKind,
                                attachment,
                                (input) => input.scope.actorUserId
                            );
                        return new SeedRunner(database, context, services);
                    },
                },
            ],
        };
    }
}
