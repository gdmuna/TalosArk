import { Injectable } from '@nestjs/common';
import { MaterialTypeWriteSchema, MaterialWriteSchema } from '@talos-ark/contracts/material';
import type { z } from 'zod';
import { DatabaseRuntime } from '../../../src/infra/database/database.runtime.js';
import { MaterialService } from '../../../src/modules/material/application/material.service.js';
import {
    materialKind,
    materialReferenceSchema,
    materialSeedInputSchema,
    type MaterialSeedData,
    type MaterialSeedOutput,
} from './seed.kind.js';
import type { SeedExecution } from '../seed.execution.js';
import type { BusinessSeeder } from '../seed.definition.js';

@Injectable()
export class MaterialSeeder implements BusinessSeeder<typeof materialKind> {
    constructor(
        private readonly materials: MaterialService,
        private readonly database: DatabaseRuntime
    ) {}

    async seed(
        data: MaterialSeedData,
        scope: z.infer<typeof materialKind.input>,
        execution: SeedExecution
    ): Promise<MaterialSeedOutput> {
        // Validate the final prefixed identifiers before committing any classification.
        const prefixedCode = (value: string | null | undefined) =>
            value ? `${execution.codePrefix}-${value}` : null;
        for (const type of data.types)
            MaterialTypeWriteSchema.parse({
                ...type.input,
                code: prefixedCode(type.input.code),
            });
        for (const item of data.materials)
            materialSeedInputSchema.parse({
                ...item.input,
                code: prefixedCode(item.input.code),
            });
        const types: Record<string, string> = {};
        const materials: MaterialSeedOutput['materials'] = {};
        for (const type of data.types) {
            const result = await execution.record({
                key: `type/${type.key}`,
                output: materialKind.output.shape.types.valueType,
                create: async () =>
                    (
                        await this.materials.createType(scope, {
                            ...type.input,
                            code: prefixedCode(type.input.code),
                        })
                    ).id,
                inspect: (id) =>
                    this.database.queryClient.materialType.findUniqueOrThrow({
                        where: { id },
                        select: {
                            id: true,
                            organizationId: true,
                            workspaceId: true,
                            code: true,
                            name: true,
                            archivedAt: true,
                        },
                    }),
            });
            types[type.key] = result;
        }
        for (const item of data.materials) {
            materials[item.key] = await execution.record({
                key: `material/${item.key}`,
                output: materialReferenceSchema,
                create: async () => {
                    const request = {
                        ...item.input,
                        typeId: types[item.typeKey],
                        code: prefixedCode(item.input.code),
                    } satisfies z.input<typeof MaterialWriteSchema>;
                    const created = await this.materials.create(
                        scope,
                        MaterialWriteSchema.parse(request)
                    );
                    if (item.archived)
                        await this.materials.archive(
                            { ...scope, materialId: created.id },
                            { archived: true }
                        );
                    return {
                        id: created.id,
                        resourceId: created.resourceId,
                        code: created.code,
                        branch: created.branch,
                    };
                },
                inspect: async ({ id }) => {
                    const { material } = await this.materials.get({ ...scope, materialId: id });
                    // Receipt datasets legitimately add instances later; timestamps are not fixture content.
                    const {
                        instanceCount: _count,
                        createdAt: _created,
                        updatedAt: _updated,
                        type: _type,
                        ...content
                    } = material;
                    return {
                        ...content,
                        aliases: [...content.aliases].sort(),
                        identifiers: [...content.identifiers].sort((left, right) =>
                            `${left.scheme}:${left.value}`.localeCompare(
                                `${right.scheme}:${right.value}`
                            )
                        ),
                    };
                },
            });
        }
        return { scope, types, materials };
    }
}
