import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { extraWorkspaceKind, teamKind, workspaceMembershipKind } from './governance.kind.js';
import {
    extraWorkspaceDataset,
    governanceTeam,
    otherOrganizationTeam,
    secondaryMemberships,
} from './governance.dataset.js';
import { memberVolume } from './volume.dataset.js';

export const governanceContribution = defineSeedContribution({
    definition: {
        id: 'governance',
        kinds: [extraWorkspaceKind, teamKind, workspaceMembershipKind],
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
