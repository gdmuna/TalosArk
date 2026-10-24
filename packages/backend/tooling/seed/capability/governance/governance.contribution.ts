import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { extraWorkspaceKind, teamKind, workspaceMembershipKind } from './governance.kind.js';
import {
    extraWorkspaceDataset,
    governanceTeam,
    otherOrganizationTeam,
    secondaryMemberships,
} from './governance.dataset.js';
import { memberVolume } from './volume.dataset.js';
import { workspaceDatabase } from '../workspace/workspace.database.js';
import { databaseTables } from '../../definition/database.js';

export const governanceContribution = defineSeedContribution({
    definition: {
        id: 'governance',
        kinds: [extraWorkspaceKind, teamKind, workspaceMembershipKind],
        database: [
            {
                kindId: extraWorkspaceKind.id,
                requires: workspaceDatabase,
                hint: 'Synchronize the workspace schema for the selected environment.',
            },
            {
                kindId: workspaceMembershipKind.id,
                requires: workspaceDatabase,
                hint: 'Synchronize the membership schema for the selected environment.',
            },
            {
                kindId: teamKind.id,
                requires: [...workspaceDatabase, ...databaseTables('OrganizationInvitation')],
                hint: 'Synchronize the team/invitation schema for the selected environment.',
            },
        ],
        datasets: [
            datasetListing(extraWorkspaceDataset),
            datasetListing(governanceTeam),
            datasetListing(otherOrganizationTeam),
            datasetListing(secondaryMemberships),
            datasetListing(memberVolume),
        ],
    },
    load: async () => (await import('./governance.runtime.js')).governanceRuntime,
});
