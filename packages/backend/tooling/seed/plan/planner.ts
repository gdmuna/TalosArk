import { SeedGroupBuilder, type SeedStep } from '../definition/group.js';
import { generationContext } from '../definition/generation.js';
import { freezeJson, seedHash, seedJson, type SeedJson } from '../definition/value.js';
import { fixtureFileRefSchema, type FixtureFileFacts } from '../fixture/fixture.definition.js';
import { SeedCatalog } from './catalog.js';
import { seedPlanRequestSchema, type SeedPlanRequest } from './request.js';
import { SeedDefinitionError } from '../definition/diagnostic.js';

export interface SeedManifest {
    readonly formatVersion: 3;
    readonly request: SeedPlanRequest;
    readonly entry: { readonly id: string; readonly version: number };
    readonly parameters: SeedJson;
    readonly steps: readonly {
        key: string;
        dataset: { id: string; version: number };
        kind: { id: string; version: number };
        parameters: SeedJson;
        contentHash: string;
        from: Readonly<Record<string, string>>;
    }[];
    readonly capabilities: readonly string[];
    readonly resources: readonly ('database' | 'object-storage')[];
    readonly exposed: Readonly<Record<string, string>>;
    readonly files: readonly FixtureFileFacts[];
    readonly fingerprint: string;
}
export interface SeedDraft {
    readonly request: SeedPlanRequest;
    readonly entry: SeedManifest['entry'];
    readonly parameters: SeedJson;
    readonly steps: readonly SeedStep[];
    readonly exposed: Readonly<Record<string, string>>;
}
export interface SeedProgram {
    readonly manifest: SeedManifest;
    readonly steps: readonly SeedStep[];
}

export class SeedPlanner {
    constructor(private readonly catalog: SeedCatalog) {}
    build(input: SeedPlanRequest): SeedDraft {
        const parsed = seedPlanRequestSchema.parse(input);
        const request = parsed;
        if (request.selection.kind === 'tags')
            request.selection.tags = [...new Set(request.selection.tags)].sort();
        freezeJson(request);
        const selection = request.selection;
        const entries =
            selection.kind === 'group'
                ? [this.catalog.group(selection.id)]
                : selection.kind === 'dataset'
                  ? [this.catalog.dataset(selection.id)]
                  : this.catalog.tagged(selection.tags);
        const b = new SeedGroupBuilder({
            scope: request.scope,
            generation: generationContext(
                request.generation.seed,
                request.generation.referenceDate
            ),
        });
        const parameters = [];
        for (const entry of entries) {
            if (!entry.scopeModes.includes(request.scope.kind))
                throw new Error(
                    `Seed entry ${entry.id} does not support scope mode ${request.scope.kind}`
                );
            try {
                parameters.push(
                    entry.build(selection.kind === 'tags' ? {} : (selection.parameters ?? {}), b)
                );
            } catch (cause) {
                throw cause instanceof SeedDefinitionError
                    ? cause
                    : new SeedDefinitionError(entry.id, undefined, cause);
            }
        }
        const built = b.finish();
        for (const step of built.steps) {
            const kind = this.catalog
                .owner(step.seederId)
                .definition.kinds.find((kind) => kind.id === step.seederId);
            if (kind?.version !== step.kindVersion)
                throw new Error(`Incompatible seed kind ${step.seederId}`);
            this.catalog.requireDataset(step.datasetId, step.version, step.seederId);
            for (const ref of step.files) fixtureFileRefSchema.parse(ref);
        }
        const entry = {
            id:
                selection.kind === 'tags'
                    ? `tags:${selection.tags.join(',')}`
                    : `${selection.kind}:${selection.id}`,
            version: selection.kind === 'tags' ? 1 : entries[0].version,
        };
        return Object.freeze({
            request: Object.freeze(request),
            entry: Object.freeze(entry),
            parameters: freezeJson(seedJson(parameters.length === 1 ? parameters[0] : parameters)),
            ...built,
        });
    }
    seal(draft: SeedDraft, files: readonly FixtureFileFacts[]): SeedProgram {
        const expected = new Set(draft.steps.flatMap((step) => step.files.map((file) => file.id)));
        if (
            files.length !== expected.size ||
            new Set(files.map((file) => file.id)).size !== expected.size ||
            files.some(
                (file) =>
                    !expected.has(file.id) ||
                    !Number.isSafeInteger(file.sizeBytes) ||
                    file.sizeBytes < 0 ||
                    !/^[a-f0-9]{64}$/.test(file.sha256)
            )
        )
            throw new Error('Prepared fixture facts do not match the plan');
        const contributions = [
            ...new Map(
                draft.steps.map((step) => {
                    const owner = this.catalog.owner(step.seederId);
                    return [owner.definition.id, owner] as const;
                })
            ).values(),
        ];
        const capabilities = contributions.map((item) => item.definition.id).sort();
        const resources = new Set<'database' | 'object-storage'>(['database']);
        for (const contribution of contributions)
            for (const resource of contribution.definition.resources ?? []) resources.add(resource);
        const content = {
            formatVersion: 3 as const,
            request: draft.request,
            entry: draft.entry,
            parameters: draft.parameters,
            steps: draft.steps.map((step) => ({
                key: step.key,
                dataset: { id: step.datasetId, version: step.version },
                kind: { id: step.seederId, version: step.kindVersion },
                parameters: step.parameters,
                contentHash: seedHash(step.data),
                from: step.from,
            })),
            capabilities,
            resources: [...resources].sort(),
            exposed: draft.exposed,
            files: [...files].sort((a, b) => a.id.localeCompare(b.id)),
        };
        freezeJson(content);
        const manifest: SeedManifest = Object.freeze({
            ...content,
            fingerprint: seedHash(content),
        });
        return Object.freeze({ manifest, steps: draft.steps });
    }
}
