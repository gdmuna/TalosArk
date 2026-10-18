import type { Prisma } from '@root/prisma/generated/client.js';
import { MaterialSchema, type Material, type MaterialType } from '@talos-ark/contracts/material';

export const materialTypeSelect = {
    id: true,
    organizationId: true,
    workspaceId: true,
    code: true,
    name: true,
    archivedAt: true,
} as const satisfies Prisma.MaterialTypeSelect;
export const materialSelect = {
    id: true,
    organizationId: true,
    workspaceId: true,
    resourceId: true,
    typeId: true,
    code: true,
    name: true,
    description: true,
    branch: true,
    attributes: true,
    manufacturer: true,
    catalogNumber: true,
    quantityUnit: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    type: { select: materialTypeSelect },
    aliases: { select: { name: true }, orderBy: { name: 'asc' } },
    identifiers: {
        select: { scheme: true, value: true },
        orderBy: [{ scheme: 'asc' }, { value: 'asc' }],
    },
    _count: { select: { instances: true } },
} as const satisfies Prisma.MaterialSelect;

export function materialTypeView(
    row: Prisma.MaterialTypeGetPayload<{ select: typeof materialTypeSelect }>
): MaterialType {
    return { ...row, archivedAt: row.archivedAt?.toISOString() ?? null };
}

export function materialView(
    row: Prisma.MaterialGetPayload<{ select: typeof materialSelect }>
): Material {
    const { _count, ...fields } = row;
    return MaterialSchema.parse({
        ...fields,
        description: row.description ?? '',
        manufacturer: row.manufacturer ?? '',
        catalogNumber: row.catalogNumber ?? '',
        aliases: row.aliases.map((item) => item.name),
        type: materialTypeView(row.type),
        archivedAt: row.archivedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        instanceCount: _count.instances,
    });
}
