import type { MaterialWrite } from '@talos-ark/contracts/material';
import { type MaterialSeedInput, type MaterialSeedDraft } from './material.kind.js';
import { type GenerationContext } from '../../definition/dataset.js';

export type MaterialBranch = MaterialWrite['branch'];

const samples = {
    consumable: ['Filter tip', 'Centrifuge tube', 'Culture dish', 'Cryovial'],
    chemical: ['Ethanol', 'Sodium chloride', 'Tris buffer', 'Dimethyl sulfoxide'],
    biological: ['HeLa cell line', 'DMEM medium', 'Fetal bovine serum', 'A549 cell line'],
} satisfies Record<MaterialBranch, readonly string[]>;

export function generateMaterials(
    branch: MaterialBranch,
    count: number,
    context: GenerationContext
): MaterialSeedInput {
    return {
        types: [{ key: branch, input: { code: branch.toUpperCase(), name: `${branch} material` } }],
        materials: Array.from(
            { length: count },
            (_, index): MaterialSeedInput['materials'][number] => {
                const number = String(index + 1).padStart(5, '0');
                const choice = context.integer(
                    `${branch}/${index}/sample`,
                    0,
                    samples[branch].length - 1
                );
                const common = {
                    code: `${branch.slice(0, 3).toUpperCase()}-${number}`,
                    name: `${samples[branch][choice]} ${number}`,
                    description: `Seed fixture; reference date ${context.referenceDate}`,
                    manufacturer: ['Example Lab', 'Example Scientific', ''][
                        context.integer(`${branch}/${index}/manufacturer`, 0, 2)
                    ],
                    catalogNumber: `CAT-${number}`,
                    quantityScale: branch === 'consumable' ? 0 : 3,
                    aliases: index === 0 ? [`${branch} reference material`] : [],
                } satisfies Pick<
                    MaterialSeedDraft,
                    | 'code'
                    | 'name'
                    | 'description'
                    | 'manufacturer'
                    | 'catalogNumber'
                    | 'quantityScale'
                    | 'aliases'
                >;
                const makeInput = (): MaterialSeedDraft => {
                    switch (branch) {
                        case 'chemical':
                            return {
                                ...common,
                                branch,
                                quantityUnit: 'mL',
                                attributes: {
                                    physicalForm: 'Liquid',
                                    purityOrConcentration: '99%',
                                },
                            };
                        case 'biological':
                            return {
                                ...common,
                                branch,
                                quantityUnit: 'mL',
                                attributes: { species: 'Homo sapiens', storageConditions: '-80 C' },
                            };
                        case 'consumable':
                            return {
                                ...common,
                                branch,
                                quantityUnit: 'piece',
                                attributes: { packaging: 'Box', specification: 'Laboratory grade' },
                            };
                        default: {
                            const unreachable: never = branch;
                            throw new Error(`Unsupported material branch ${unreachable}`);
                        }
                    }
                };
                return { key: `${branch}-${number}`, typeKey: branch, input: makeInput() };
            }
        ),
    };
}
