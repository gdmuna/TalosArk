import { useQuerySelection } from '@/platform/navigation';

export function useResourceView(ids: readonly string[], defaultView = ids[0] ?? '') {
    const { value: view, select } = useQuerySelection(ids, 'view', defaultView);
    return { view, select };
}
