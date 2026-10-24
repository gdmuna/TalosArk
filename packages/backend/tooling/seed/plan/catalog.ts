import { z } from 'zod';
import type { BoundDataset, DatasetDefinition, SeederKind } from '../definition/dataset.js';
import { type DatasetGroup, type SeedGroupBuilder } from '../definition/group.js';
import { seedJson, type SeedJson } from '../definition/value.js';
import type { SeedRuntimeDefinition } from '../runtime/contribution.js';
import type { SeedScopeSelection } from '../definition/scope.js';

export interface SeedEntry {
    readonly id: string;
    readonly version: number;
    readonly description: string;
    readonly purpose: DatasetGroup<z.ZodType>['purpose'];
    readonly tags: readonly string[];
    readonly scopeModes: readonly SeedScopeSelection['kind'][];
    build(parameters: unknown, builder: SeedGroupBuilder): SeedJson;
}
export function groupEntry<P extends z.ZodType>(group: DatasetGroup<P>): SeedEntry {
    return {
        ...group,
        tags: [],
        build: (parameters, b) => {
            const parsed = z.parse<P>(group.parameters, parameters);
            group.build(parsed, b);
            return seedJson(parsed);
        },
    };
}
export function datasetListing<K extends SeederKind, P extends z.ZodType>(
    dataset: BoundDataset<K, P>
) {
    const { id, version, tags, description } = dataset.definition;
    return { id, version, tags, description, kindId: dataset.kind.id };
}
export function datasetEntry<K extends SeederKind, P extends z.ZodType>(
    dataset: BoundDataset<K, P>,
    compose: (parameters: unknown, builder: SeedGroupBuilder) => void
): SeedEntry {
    const volume = dataset.definition.tags.includes('volume');
    return {
        ...datasetListing(dataset),
        purpose: volume
            ? 'volume'
            : dataset.definition.tags.includes('regression')
              ? 'regression'
              : 'demo',
        scopeModes: ['provision', 'actor', 'workspace'],
        build(parameters, b) {
            if (
                volume &&
                (!parameters || typeof parameters !== 'object' || !('count' in parameters))
            )
                throw new Error('Volume datasets require an explicit count');
            const parsed = dataset.definition.parameters.parse(parameters);
            compose(parameters, b);
            return seedJson(parsed);
        },
    };
}
export interface SeedContribution {
    readonly definition: {
        readonly id: string;
        readonly kinds: readonly SeederKind[];
        readonly datasets: readonly (Pick<
            DatasetDefinition<z.ZodType, unknown>,
            'id' | 'version' | 'tags' | 'description'
        > & { readonly kindId: string })[];
        readonly entries?: readonly SeedEntry[];
        readonly resources?: readonly 'object-storage'[];
    };
    load(): Promise<SeedRuntimeDefinition>;
}
export function defineSeedContribution(contribution: SeedContribution): SeedContribution {
    return Object.freeze(contribution);
}

export class SeedCatalog {
    private readonly owners = new Map<string, SeedContribution>();
    private readonly groupMap = new Map<string, SeedEntry>();
    private readonly datasetMap = new Map<string, SeedEntry>();

    constructor(
        readonly contributions: readonly SeedContribution[],
        groups: readonly SeedEntry[]
    ) {
        const capabilityIds = new Set<string>();
        const datasetIds = new Set<string>();
        for (const contribution of contributions) {
            const definition = contribution.definition;
            if (capabilityIds.has(definition.id))
                throw new Error(`Duplicate seed capability: ${definition.id}`);
            capabilityIds.add(definition.id);
            for (const kind of definition.kinds) {
                if (this.owners.has(kind.id) || !Number.isInteger(kind.version) || kind.version < 1)
                    throw new Error(`Invalid or duplicate seed kind: ${kind.id}`);
                this.owners.set(kind.id, contribution);
            }
            for (const dataset of definition.datasets) {
                if (
                    datasetIds.has(dataset.id) ||
                    !definition.kinds.some((kind) => kind.id === dataset.kindId) ||
                    !Number.isInteger(dataset.version) ||
                    dataset.version < 1
                )
                    throw new Error(`Invalid or duplicate seed dataset: ${dataset.id}`);
                datasetIds.add(dataset.id);
            }
            for (const entry of definition.entries ?? []) {
                if (
                    !definition.datasets.some((dataset) => dataset.id === entry.id) ||
                    this.datasetMap.has(entry.id)
                )
                    throw new Error(`Invalid seed dataset entry: ${entry.id}`);
                this.datasetMap.set(entry.id, entry);
            }
        }
        for (const group of groups) {
            if (this.groupMap.has(group.id)) throw new Error(`Duplicate seed group: ${group.id}`);
            this.groupMap.set(group.id, group);
        }
    }
    group(id: string): SeedEntry {
        const entry = this.groupMap.get(id);
        if (!entry)
            throw new Error(
                `Unknown group ${id}${id === 'authorization-regression' ? '; its identical fixtures are now included in governance-demo' : ''}`
            );
        return entry;
    }
    dataset(id: string): SeedEntry {
        const entry = this.datasetMap.get(id);
        if (!entry) throw new Error(`Dataset ${id} is unknown or requires an explicit group`);
        return entry;
    }
    tagged(tags: readonly string[]): readonly SeedEntry[] {
        const entries = [...this.datasetMap.values()].filter((entry) =>
            tags.every((tag) => entry.tags.includes(tag))
        );
        if (entries.some((entry) => entry.purpose === 'volume'))
            throw new Error(
                'Tag selection includes volume data; select one volume dataset with an explicit count'
            );
        if (!entries.length)
            throw new Error('No independently selectable datasets match these tags');
        return entries.sort((a, b) => a.id.localeCompare(b.id));
    }
    owner(kind: string): SeedContribution {
        const contribution = this.owners.get(kind);
        if (!contribution) throw new Error(`No seed capability owns kind ${kind}`);
        return contribution;
    }
    requireDataset(id: string, version: number, kindId: string): void {
        if (
            !this.owner(kindId).definition.datasets.some(
                (dataset) =>
                    dataset.id === id && dataset.version === version && dataset.kindId === kindId
            )
        )
            throw new Error(
                `Unregistered or incompatible seed dataset ${id}@${version} for ${kindId}`
            );
    }
    list() {
        return {
            groups: [...this.groupMap.values()].map(
                ({ id, version, description, purpose, scopeModes }) => ({
                    id,
                    version,
                    description,
                    purpose,
                    scopeModes,
                })
            ),
            datasets: this.contributions.flatMap(({ definition }) =>
                definition.datasets.map((dataset) => ({
                    ...dataset,
                    capability: definition.id,
                    selection: this.datasetMap.has(dataset.id) ? 'independent' : 'group',
                }))
            ),
        };
    }
}
export type SeedCatalogView = ReturnType<SeedCatalog['list']>;
