import { z } from 'zod';
import { defineGroup } from '../definition/group.js';
import { materialVolume } from '../capability/material/material.dataset.js';
import { attachmentDataset } from '../capability/attachment/attachment.dataset.js';
import { addWorkspaceBaseline } from './baseline.js';
export const attachmentIntegrationGroup = defineGroup({
    id: 'attachment-integration',
    version: 2,
    purpose: 'integration',
    description:
        'Real local fixture and generated single/multipart uploads, binding and download checks',
    parameters: z.strictObject({
        fixtureId: z.string().default('material/notes.txt'),
        filename: z.string().default('seed-notes.txt'),
        contentType: z.string().default('text/plain'),
    }),
    scopeModes: ['provision', 'actor', 'workspace'],
    build(parameters, b) {
        const scope = addWorkspaceBaseline(b);
        const material = b.step(
            'material',
            materialVolume,
            { branch: 'chemical', count: 1 },
            { from: { scope }, bind: ({ scope }) => scope }
        );
        const attachment = b.step('attachment', attachmentDataset, parameters, {
            from: { material },
            bind: ({ material }) => material,
        });
        b.expose({ primaryScope: scope, materials: material, attachments: attachment });
    },
});
