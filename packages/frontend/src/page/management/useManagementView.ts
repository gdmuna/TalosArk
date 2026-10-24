import { computed } from 'vue';
import { useQuerySelection } from '@/platform/navigation';

export type ManagementView = { value: string; label: string };

export function useManagementView(views: readonly ManagementView[], queryKey = 'view') {
    const { value, select } = useQuerySelection(
        views.map((view) => view.value),
        queryKey
    );
    return computed({
        get: () => value.value,
        set: (next: string) => {
            void select(next);
        },
    });
}
