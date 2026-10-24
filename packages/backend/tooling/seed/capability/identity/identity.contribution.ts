import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { accountsKind } from './account.kind.js';
import { credentialKind } from './credential.kind.js';
import { ownerAccount, governanceAccounts } from './account.dataset.js';
import { credentialDataset } from './credential.dataset.js';
import { memberAccounts } from './account-volume.dataset.js';
import { databaseTables } from '../../definition/database.js';

const accountDatabase = [
    ...databaseTables('User', 'UserProfile', 'UserActivationToken'),
    {
        type: 'constraint' as const,
        schema: 'public',
        table: 'User',
        name: 'User_email_normalized_check',
    },
];

export const identityContribution = defineSeedContribution({
    definition: {
        id: 'identity',
        kinds: [accountsKind, credentialKind],
        database: [
            {
                kindId: accountsKind.id,
                requires: accountDatabase,
                hint: 'Synchronize the schema and run db:apply-identity-ddl for the selected environment.',
            },
            {
                kindId: credentialKind.id,
                requires: [...accountDatabase, ...databaseTables('PasswordResetToken')],
                hint: 'Synchronize the schema and run db:apply-identity-ddl for the selected environment.',
            },
        ],
        datasets: [
            datasetListing(ownerAccount),
            datasetListing(governanceAccounts),
            datasetListing(credentialDataset),
            datasetListing(memberAccounts),
        ],
    },
    load: async () => (await import('./identity.runtime.js')).identityRuntime,
});
