import { defineDatasetFor } from '../seed.definition.js';
import { workspaceKind } from '../seeder/seed.kind.js';

export const workspaceDataset = defineDatasetFor(workspaceKind)({
    id: 'workspace',
    version: 2,
    tags: ['workspace', 'baseline'],
    description:
        'Create an organization and workspace through their business services, or verify the selected existing scope',
    parameters: workspaceKind.data.partial(),
    build: (parameters) => ({
        name: 'Seed laboratory',
        workspaceName: 'Seed workspace',
        ...parameters,
    }),
});
