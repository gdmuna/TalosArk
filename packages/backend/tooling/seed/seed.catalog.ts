import { z } from 'zod';
import {
    datasetStepFromUnknown,
    generationContext,
    type BoundDataset,
    type SeedStep,
} from './seed.definition.js';
import {
    biologicalDemo,
    chemicalDemo,
    consumableDemo,
    materialRegression,
    materialVolume,
} from './dataset/material/material.dataset.js';
import {
    labDemoGroup,
    materialDemoGroup,
    materialRegressionGroup,
    materialVolumeGroup,
    minimalGroup,
    baselineSteps,
    type GroupContext,
} from './group/seed.group.js';
import type { SeedPlan } from './seed.runner.js';
import { materialKind, scopeReferenceSchema } from './seeder/seed.kind.js';
import { governanceDemoGroup, authorizationRegressionGroup } from './group/governance.group.js';
import { businessDemoGroup } from './group/business.group.js';
import { governanceVolumeGroup, inventoryVolumeGroup } from './group/volume.group.js';
import { credentialRegressionGroup } from './group/credential.group.js';
import { workspaceDataset } from './dataset/workspace.dataset.js';
import { ownerAccount, governanceAccounts } from './dataset/account.dataset.js';
import {
    extraWorkspaceDataset,
    governanceTeam,
    otherOrganizationTeam,
    secondaryMemberships,
} from './dataset/governance.dataset.js';
import {
    batchDataset,
    lifecycleReceiptDataset,
    inventoryHistoryDataset,
} from './dataset/inventory.dataset.js';
import { facilityDataset, receiptDataset } from './dataset/laboratory.dataset.js';
import { facilityLifecycleDataset } from './dataset/facility.dataset.js';
import { approvalDataset } from './dataset/approval.dataset.js';
import { memberAccounts, memberVolume } from './dataset/volume.dataset.js';
import { credentialDataset } from './dataset/credential.dataset.js';
import { attachmentDataset } from './dataset/attachment.dataset.js';
import { attachmentIntegrationGroup } from './group/attachment.group.js';

export const seedGroups = [
    minimalGroup,
    materialDemoGroup,
    materialVolumeGroup,
    materialRegressionGroup,
    labDemoGroup,
    governanceDemoGroup,
    authorizationRegressionGroup,
    businessDemoGroup,
    governanceVolumeGroup,
    inventoryVolumeGroup,
    credentialRegressionGroup,
    attachmentIntegrationGroup,
] as const;

// Only independently usable material datasets are exposed to direct/tag selection.
// Facility and receipt definitions require group-provided references.
function selectable<P extends z.ZodType>(dataset: BoundDataset<typeof materialKind, P>) {
    return {
        ...dataset.definition,
        step(
            parameters: unknown,
            context: GroupContext,
            scope: SeedStep<z.output<typeof scopeReferenceSchema>>
        ) {
            return datasetStepFromUnknown(
                dataset.definition.id,
                dataset,
                parameters,
                context.generation,
                (results) => results.get(scope)
            );
        },
    };
}

// The shared scope schema gives all exposed datasets the same typed prerequisite.
export const seedDatasets = [
    selectable(consumableDemo),
    selectable(chemicalDemo),
    selectable(biologicalDemo),
    selectable(materialVolume),
    selectable(materialRegression),
];

export const seedDatasetCatalog = [
    ...seedDatasets.map(({ id, version, description, tags }) => ({
        id,
        version,
        description,
        tags,
        selection: 'independent',
    })),
    ...[
        workspaceDataset,
        ownerAccount,
        governanceAccounts,
        extraWorkspaceDataset,
        governanceTeam,
        otherOrganizationTeam,
        secondaryMemberships,
        batchDataset,
        lifecycleReceiptDataset,
        inventoryHistoryDataset,
        facilityDataset,
        receiptDataset,
        facilityLifecycleDataset,
        approvalDataset,
        memberAccounts,
        memberVolume,
        credentialDataset,
        attachmentDataset,
    ].map(({ definition: { id, version, description, tags } }) => ({
        id,
        version,
        description,
        tags,
        selection: 'group',
    })),
];

export interface SeedSelection {
    group?: string;
    dataset?: string;
    tags?: readonly string[];
    parameters?: unknown;
    namespace: string;
    actorUserId?: string;
    target?: { organizationId: string; workspaceId: string };
    seed?: number;
    referenceDate?: string;
}

export function createSeedPlan(selection: SeedSelection): SeedPlan {
    const namespace = z
        .string()
        .regex(/^[a-z][a-z0-9-]{0,47}$/)
        .parse(selection.namespace);
    const actorUserId = z.uuid().toLowerCase().optional().parse(selection.actorUserId);
    const target = selection.target
        ? z
              .strictObject({
                  organizationId: z.uuid().toLowerCase(),
                  workspaceId: z.uuid().toLowerCase(),
              })
              .parse(selection.target)
        : null;
    const seed = z
        .number()
        .int()
        .min(0)
        .max(0xffffffff)
        .parse(selection.seed ?? 42);
    const referenceDate = z.iso.date().parse(selection.referenceDate ?? '2026-01-01');
    const context: GroupContext = {
        actorUserId,
        target,
        generation: generationContext(seed, referenceDate),
    };
    const tags = [...new Set(selection.tags)].sort();
    const selectors =
        Number(!!selection.group) + Number(!!selection.dataset) + Number(!!tags.length);
    if (selectors !== 1) throw new Error('Select exactly one --group, --dataset or --tag');
    if (selection.group) {
        const group = seedGroups.find((item) => item.id === selection.group);
        if (!group) throw new Error(`Unknown group ${selection.group}`);
        const built = group.build(selection.parameters ?? {}, context);
        return {
            entry: `group:${group.id}`,
            version: group.version,
            namespace,
            actorUserId,
            target,
            seed,
            referenceDate,
            ...built,
        };
    }
    const datasets = selection.dataset
        ? seedDatasets.filter((item) => item.id === selection.dataset)
        : seedDatasets.filter((item) => tags.every((tag) => item.tags.includes(tag)));
    if (!datasets.length) throw new Error('No datasets match the selector');
    if (tags.length && selection.parameters !== undefined)
        throw new Error(
            'Tag selection uses dataset defaults; use a group or one dataset to supply parameters'
        );
    const { scope, steps: baseline } = baselineSteps(context);
    const steps = [
        ...baseline,
        ...datasets.map((dataset) => dataset.step(selection.parameters ?? {}, context, scope)),
    ];
    return {
        entry: selection.dataset ? `dataset:${selection.dataset}` : `tags:${tags.join(',')}`,
        version: 1,
        namespace,
        actorUserId,
        target,
        seed,
        referenceDate,
        parameters: selection.dataset ? steps[baseline.length].parameters : {},
        steps,
    };
}
