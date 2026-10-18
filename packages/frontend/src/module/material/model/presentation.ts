import { Dna, FlaskConical, Package } from '@lucide/vue';
import type { MaterialBranch } from '@talos-ark/contracts/material';

export const materialBranches = [
    {
        id: 'consumable',
        label: '普通耗材',
        icon: Package,
        color: 'var(--chart-6)',
        fields: [
            { key: 'specification', label: '规格' },
            { key: 'packaging', label: '包装说明' },
            { key: 'composition', label: '材质' },
        ],
    },
    {
        id: 'chemical',
        label: '化学材料',
        icon: FlaskConical,
        color: 'var(--chart-3)',
        fields: [
            { key: 'molecularFormula', label: '分子式' },
            { key: 'purityOrConcentration', label: '纯度或浓度' },
            { key: 'physicalForm', label: '形态' },
        ],
    },
    {
        id: 'biological',
        label: '生物材料',
        icon: Dna,
        color: 'var(--chart-2)',
        fields: [
            { key: 'source', label: '来源' },
            { key: 'species', label: '物种' },
            { key: 'storageConditions', label: '保存条件' },
        ],
    },
] as const;
export const branchPresentation = (branch: MaterialBranch) => {
    const index = { consumable: 0, chemical: 1, biological: 2 } as const;
    return materialBranches[index[branch]];
};
export const materialDate = (value: string) =>
    new Date(value).toLocaleString('zh-CN', { hour12: false });
