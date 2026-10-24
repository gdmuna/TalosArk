import { z } from 'zod';
import { defineDatasetFor } from '../../definition/dataset.js';
import { attachmentKind } from './attachment.kind.js';

export const attachmentDataset = defineDatasetFor(attachmentKind)({
    id: 'material-attachment',
    version: 2,
    tags: ['material', 'attachment', 'integration', 'legal'],
    description:
        'Actual TXT/single and CSV/multipart uploads, SHA-256 verification, binding, download and unbinding',
    parameters: z.strictObject({
        fixtureId: z.string().default('material/notes.txt'),
        filename: z.string().default('seed-notes.txt'),
        contentType: z.string().default('text/plain'),
    }),
    files: (data) =>
        data.files.flatMap((file) => (file.source.kind === 'fixture' ? [file.source] : [])),
    build: (parameters) => ({
        files: [
            {
                key: 'single',
                materialKey: 'chemical-00001',
                input: {
                    filename: parameters.filename,
                    contentType: parameters.contentType,
                    mode: 'single',
                },
                source: { kind: 'fixture', id: parameters.fixtureId },
            },
            {
                key: 'multipart',
                materialKey: 'chemical-00001',
                input: {
                    filename: 'seed-measurements.csv',
                    contentType: 'text/csv',
                    mode: 'multipart',
                },
                source: { kind: 'generated', text: 'value,unit\n1,mL\n', repeat: 600000 },
            },
            {
                key: 'removed',
                materialKey: 'chemical-00001',
                input: { filename: 'seed-removed.txt', contentType: 'text/plain', mode: 'single' },
                source: { kind: 'generated', text: 'Removed attachment fixture\n', repeat: 1 },
                unbind: true,
            },
        ],
    }),
});
