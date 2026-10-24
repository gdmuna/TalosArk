import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { OrganizationContextModule } from '@/core/organization-context/index.js';
import { AuthorizationModule } from '@/core/authorization/index.js';
import { PermissionModule } from '@/core/permission/index.js';
import { TeamGovernanceKernel } from './team-governance.kernel.js';

@Module({
    imports: [DatabaseModule, OrganizationContextModule, AuthorizationModule, PermissionModule],
    providers: [TeamGovernanceKernel],
    exports: [TeamGovernanceKernel],
})
export class TeamGovernanceModule {}
