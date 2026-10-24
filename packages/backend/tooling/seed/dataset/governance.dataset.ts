import { z } from 'zod';
import { defineDatasetFor } from '../seed.definition.js';
import {
    extraWorkspaceKind,
    teamKind,
    workspaceMembershipKind,
} from '../seeder/governance.kind.js';
import {
    workspacePermission,
    organizationPermission,
} from '../../../src/core/team-governance/index.js';
import { materialPermission } from '../../../src/modules/material/contribution/material-authorization.contribution.js';
import { inventoryPermission } from '../../../src/modules/inventory/contribution/inventory-authorization.contribution.js';
import { approvalPermission } from '../../../src/modules/approval/contribution/approval-authorization.contribution.js';
import { facilityPermission } from '../../../src/modules/facility/contribution/facility-authorization.contribution.js';

export const extraWorkspaceDataset = defineDatasetFor(extraWorkspaceKind)({
    id: 'workspace-extra',
    version: 1,
    tags: ['workspace', 'governance', 'legal'],
    description: 'An additional workspace with a distinct scope',
    parameters: z.strictObject({ name: z.string().min(1).max(40).default('Secondary laboratory') }),
    build: ({ name }) => ({ name, description: 'Independent seed workspace' }),
});

export const governanceTeam = defineDatasetFor(teamKind)({
    id: 'team-governance',
    version: 1,
    tags: ['team', 'governance', 'authorization', 'legal'],
    description:
        'Scoped roles, active/departed/rejoined members and pending/revoked/resent invitations',
    parameters: z.strictObject({}),
    build: () => ({
        roles: [
            {
                key: 'observer',
                input: {
                    code: 'seed-observer',
                    name: 'Organization observer',
                    scope: 'ORGANIZATION',
                    permissions: [organizationPermission.read],
                },
            },
            {
                key: 'reader',
                input: {
                    code: 'seed-reader',
                    name: 'Material reader',
                    scope: 'WORKSPACE',
                    permissions: [workspacePermission.read, materialPermission.read],
                },
            },
            {
                key: 'operator',
                input: {
                    code: 'seed-operator',
                    name: 'Inventory operator',
                    scope: 'WORKSPACE',
                    permissions: [
                        ...Object.values(materialPermission),
                        ...Object.values(inventoryPermission),
                        facilityPermission.read,
                        facilityPermission.use,
                        approvalPermission.consumeApply,
                        approvalPermission.transferApply,
                    ],
                },
            },
            {
                key: 'reviewer',
                input: {
                    code: 'seed-reviewer',
                    name: 'Approval reviewer',
                    scope: 'WORKSPACE',
                    permissions: [
                        materialPermission.read,
                        inventoryPermission.read,
                        facilityPermission.read,
                        facilityPermission.use,
                        ...Object.values(approvalPermission),
                    ],
                },
            },
            {
                key: 'retired',
                input: {
                    code: 'seed-retired',
                    name: 'Retired role',
                    scope: 'WORKSPACE',
                    permissions: [],
                },
                archived: true,
            },
        ],
        members: [
            { account: 'manager', roles: ['reader', 'operator', 'reviewer'] },
            { account: 'operator', roles: ['operator'] },
            { account: 'reviewer', roles: ['reviewer'] },
            { account: 'reader', roles: ['reader'] },
            { account: 'org-only', workspace: false, roles: ['observer'] },
            { account: 'basic' },
            { account: 'departed', roles: [], lifecycle: 'left' },
            { account: 'multi', roles: ['reader', 'operator'], lifecycle: 'rejoined' },
        ],
        invitations: [
            { key: 'pending', account: 'outsider', state: 'pending' },
            { key: 'revoked', account: 'owner-b', state: 'revoked' },
            { key: 'resent', account: 'owner-b', workspace: true, state: 'resent' },
        ],
        checks: [
            { account: 'reader', permissionCode: materialPermission.read, allowed: true },
            { account: 'reader', permissionCode: materialPermission.update, allowed: false },
            ...['outsider', 'departed', 'org-only', 'basic'].map((account) => ({
                account,
                permissionCode: materialPermission.read,
                allowed: false,
            })),
        ],
    }),
});

export const otherOrganizationTeam = defineDatasetFor(teamKind)({
    id: 'team-other-organization',
    version: 1,
    tags: ['team', 'authorization', 'isolation', 'legal'],
    description: 'One user in two organizations, with independent role bindings',
    parameters: z.strictObject({}),
    build: () => ({
        roles: [
            {
                key: 'reader',
                input: {
                    code: 'seed-reader',
                    name: 'Other material reader',
                    scope: 'WORKSPACE',
                    permissions: [materialPermission.read],
                },
            },
        ],
        members: [{ account: 'multi', roles: ['reader'] }],
        invitations: [],
        checks: [
            { account: 'multi', permissionCode: materialPermission.read, allowed: true },
            { account: 'reader', permissionCode: materialPermission.read, allowed: false },
        ],
    }),
});

export const secondaryMemberships = defineDatasetFor(workspaceMembershipKind)({
    id: 'workspace-membership-state',
    version: 1,
    tags: ['workspace', 'membership', 'isolation', 'legal'],
    description:
        'Multi-workspace access and a workspace-only departure retaining organization membership',
    parameters: z.strictObject({}),
    build: () => ({
        members: [
            { account: 'multi', roles: ['reader'] },
            { account: 'reader', leave: true },
        ],
    }),
});
