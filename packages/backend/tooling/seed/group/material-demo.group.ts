import { z } from 'zod';
import { defineGroup } from '../definition/group.js';
import { addWorkspaceBaseline } from './baseline.js';
import {
    biologicalDemo,
    chemicalDemo,
    consumableDemo,
    materialRegression,
    materialVolume,
} from '../capability/material/material.dataset.js';
import { facilityDataset } from '../capability/facility/facility.dataset.js';
import { receiptDataset } from '../capability/inventory/receipt.dataset.js';

const scopeModes = ['provision', 'actor', 'workspace'] as const;
export const minimalGroup = defineGroup({
    id: 'minimal',
    version: 2,
    purpose: 'demo',
    description: 'An organization and workspace for the selected account',
    parameters: z.strictObject({}),
    scopeModes,
    build(_p, b) {
        b.expose({ primaryScope: addWorkspaceBaseline(b) });
    },
});
export const materialDemoGroup = defineGroup({
    id: 'material-demo',
    version: 2,
    purpose: 'demo',
    description: '20 consumable, 15 chemical and 15 biological materials',
    parameters: z.strictObject({}),
    scopeModes,
    build(_p, b) {
        const scope = addWorkspaceBaseline(b);
        const consumable = b.step(
            'consumable',
            consumableDemo,
            {},
            { from: { scope }, bind: ({ scope }) => scope }
        );
        const chemical = b.step(
            'chemical',
            chemicalDemo,
            {},
            { from: { scope }, bind: ({ scope }) => scope }
        );
        const biological = b.step(
            'biological',
            biologicalDemo,
            {},
            { from: { scope }, bind: ({ scope }) => scope }
        );
        b.expose({
            primaryScope: scope,
            consumables: consumable,
            chemicals: chemical,
            biologicals: biological,
        });
    },
});
export const materialVolumeGroup = defineGroup({
    id: 'material-volume',
    version: 2,
    purpose: 'volume',
    description: 'Explicitly sized material volume in one workspace',
    parameters: materialVolume.definition.parameters.extend({
        count: z.number().int().min(1).max(10000),
    }),
    scopeModes,
    build(parameters, b) {
        const scope = addWorkspaceBaseline(b);
        const material = b.step('material', materialVolume, parameters, {
            from: { scope },
            bind: ({ scope }) => scope,
        });
        b.expose({ primaryScope: scope, materials: material });
    },
});
export const materialRegressionGroup = defineGroup({
    id: 'material-regression',
    version: 2,
    purpose: 'regression',
    description: 'Valid material boundaries, codes and archive states',
    parameters: z.strictObject({}),
    scopeModes,
    build(_p, b) {
        const scope = addWorkspaceBaseline(b);
        const material = b.step(
            'material',
            materialRegression,
            {},
            { from: { scope }, bind: ({ scope }) => scope }
        );
        b.expose({ primaryScope: scope, materials: material });
    },
});
export const labDemoGroup = defineGroup({
    id: 'lab-demo',
    version: 2,
    purpose: 'demo',
    description: 'Chemical materials, a cabinet and real stock receipts',
    parameters: z.strictObject({}),
    scopeModes,
    build(_p, b) {
        const scope = addWorkspaceBaseline(b);
        const materials = b.step(
            'material',
            chemicalDemo,
            {},
            { from: { scope }, bind: ({ scope }) => scope }
        );
        const facility = b.step(
            'facility',
            facilityDataset,
            { positions: 15 },
            { from: { scope }, bind: ({ scope }) => scope }
        );
        const receipt = b.step(
            'receipt',
            receiptDataset,
            {},
            { from: { materials, facility }, bind: (values) => values }
        );
        b.expose({ primaryScope: scope, materials, facility, stock: receipt });
    },
});
