import { computed } from 'vue';
import { Dna, FlaskConical, Package } from '@lucide/vue';
import { useWorkbenchStore, type Resource } from '@/module/workbench';

export const materialBranches = [
    {
        id: 'consumable',
        label: '耗材',
        icon: Package,
        color: 'var(--chart-6)',
        fields: ['规格', '包装规格'],
    },
    {
        id: 'chemical',
        label: '化学试剂',
        icon: FlaskConical,
        color: 'var(--chart-3)',
        fields: ['CAS 编号', '纯度 / 浓度'],
    },
    {
        id: 'biological',
        label: '生物材料',
        icon: Dna,
        color: 'var(--chart-2)',
        fields: ['生物来源', '物种'],
    },
] as const;

export function materialBranch(resource: Resource) {
    return materialBranches.find((branch) => branch.id === resource.material?.branch);
}

export function useMaterialSummary() {
    const workbench = useWorkbenchStore();
    const materials = computed(() =>
        workbench.currentResources.filter((item) => item.kind === '材料定义')
    );
    const instancesByMaterial = computed(() => {
        const index = new Map<string, Resource[]>();
        for (const item of workbench.currentResources) {
            if (item.kind !== '库存实例' || !item.materialId) continue;
            const instances = index.get(item.materialId) ?? [];
            instances.push(item);
            index.set(item.materialId, instances);
        }
        return index;
    });
    const distribution = computed(() =>
        materialBranches.map((branch) => ({
            ...branch,
            count: materials.value.filter((item) => item.material?.branch === branch.id).length,
        }))
    );
    const unclassified = computed(() => materials.value.filter((item) => !item.material).length);
    return { workbench, materials, instancesByMaterial, distribution, unclassified };
}
