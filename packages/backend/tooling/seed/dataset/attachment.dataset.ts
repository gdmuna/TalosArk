import { z } from 'zod';
import { defineDatasetFor } from '../seed.definition.js';
import { attachmentKind } from '../seeder/attachment.kind.js';

export const attachmentDataset = defineDatasetFor(attachmentKind)({
    id: 'material-attachment',
    version: 1,
    tags: ['material', 'attachment', 'integration', 'legal'],
    description:
        'Actual TXT/single and CSV/multipart uploads, SHA-256 verification, binding, download and unbinding',
    parameters: z.strictObject({}),
    build: () => ({
        files: [
            {
                key: 'single',
                input: { filename: 'seed-notes.txt', contentType: 'text/plain', mode: 'single' },
                text: 'Material attachment fixture\n',
                repeat: 20,
            },
            {
                key: 'multipart',
                input: {
                    filename: 'seed-measurements.csv',
                    contentType: 'text/csv',
                    mode: 'multipart',
                },
                text: 'value,unit\n1,mL\n',
                repeat: 600000,
            },
            {
                key: 'removed',
                input: { filename: 'seed-removed.txt', contentType: 'text/plain', mode: 'single' },
                text: 'Removed attachment fixture\n',
                repeat: 1,
                unbind: true,
            },
        ],
    }),
});
