import { defineSeedContribution, datasetListing } from '../../plan/catalog.js';
import { attachmentKind } from './attachment.kind.js';
import { attachmentDataset } from './attachment.dataset.js';
import { databaseTables } from '../../definition/database.js';
import { materialDatabase } from '../material/material.database.js';

export const attachmentContribution = defineSeedContribution({
    definition: {
        id: 'attachment',
        kinds: [attachmentKind],
        database: [
            {
                kindId: attachmentKind.id,
                requires: [
                    ...materialDatabase,
                    ...databaseTables(
                        'FileObject',
                        'FileAsset',
                        'FileReference',
                        'FileUploadSession'
                    ),
                ],
                hint: 'Synchronize the file/material schema for the selected environment; provision storage separately.',
            },
        ],
        datasets: [datasetListing(attachmentDataset)],
        resources: ['object-storage'],
    },
    load: async () => (await import('./attachment.runtime.js')).attachmentRuntime,
});
