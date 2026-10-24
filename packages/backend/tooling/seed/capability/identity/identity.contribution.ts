import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { accountsKind } from './account.kind.js';
import { credentialKind } from './credential.kind.js';
import { ownerAccount, governanceAccounts } from './account.dataset.js';
import { credentialDataset } from './credential.dataset.js';
import { memberAccounts } from './account-volume.dataset.js';

export const identityContribution = defineSeedContribution({
    definition: {
        id: 'identity',
        kinds: [accountsKind, credentialKind],
        datasets: [
            datasetListing(ownerAccount),
            datasetListing(governanceAccounts),
            datasetListing(credentialDataset),
            datasetListing(memberAccounts),
        ],
    },
    load: async () => (await import('./identity.runtime.js')).identityRuntime,
});
