import { z } from 'zod';
import { defineGroup } from '../definition/group.js';
import { addWorkspaceBaseline } from './baseline.js';
import { memberVolume } from '../capability/governance/volume.dataset.js';
import { memberAccounts } from '../capability/identity/account-volume.dataset.js';
import { workspaceDataset } from '../capability/workspace/workspace.dataset.js';
import { materialVolume } from '../capability/material/material.dataset.js';
import { facilityDataset } from '../capability/facility/facility.dataset.js';
import { receiptDataset } from '../capability/inventory/receipt.dataset.js';

export const governanceVolumeGroup = defineGroup({
    id: 'governance-volume',
    version: 2,
    purpose: 'volume',
    description: 'Explicitly sized real membership volume',
    parameters: z.strictObject({ count: z.number().int().min(1).max(199) }),
    scopeModes: ['provision'],
    build(parameters, b) {
        const accounts = b.step('account', memberAccounts, parameters, {
            from: {},
            bind: () => ({}),
        });
        const scope = b.step(
            'workspace',
            workspaceDataset,
            {},
            {
                from: { accounts },
                bind: ({ accounts }) => ({ actorUserId: accounts.owner.userId, target: null }),
            }
        );
        const members = b.step('team', memberVolume, parameters, {
            from: { scope, accounts },
            bind: (values) => values,
        });
        b.expose({ accounts, primaryScope: scope, members });
    },
});
export const inventoryVolumeGroup = defineGroup({
    id: 'inventory-volume',
    version: 2,
    purpose: 'volume',
    description: 'Explicitly sized stock volume with exclusive positions',
    parameters: z.strictObject({ count: z.number().int().min(1).max(100) }),
    scopeModes: ['provision', 'actor', 'workspace'],
    build(parameters, b) {
        const scope = addWorkspaceBaseline(b);
        const materials = b.step(
            'material',
            materialVolume,
            { count: parameters.count, branch: 'chemical' },
            { from: { scope }, bind: ({ scope }) => scope }
        );
        const facility = b.step(
            'facility',
            facilityDataset,
            { positions: parameters.count },
            { from: { scope }, bind: ({ scope }) => scope }
        );
        const receipt = b.step(
            'receipt',
            receiptDataset,
            {},
            { from: { materials, facility }, bind: (values) => values }
        );
        b.expose({ primaryScope: scope, stock: receipt });
    },
});
