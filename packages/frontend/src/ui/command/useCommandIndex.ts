import { computed, reactive } from 'vue';
import { useFilter } from 'reka-ui';

export function useCommandIndex() {
    const items = reactive(new Map<string, { text: string; groupId?: string }>());
    const { contains } = useFilter({ sensitivity: 'base' });
    const filterState = reactive({
        search: '',
        filtered: computed(() => {
            const matches = new Map<string, number>();
            const groups = new Set<string>();
            let count = 0;
            for (const [id, item] of items) {
                const match = !filterState.search || contains(item.text, filterState.search);
                matches.set(id, match ? 1 : 0);
                if (match) {
                    count++;
                    if (item.groupId) groups.add(item.groupId);
                }
            }
            return { count, items: matches, groups };
        }),
    });
    function updateItem(id: string, text: string, groupId?: string) {
        const previous = items.get(id);
        if (previous?.text !== text || previous.groupId !== groupId)
            items.set(id, { text, groupId });
    }
    function removeItem(id: string) {
        items.delete(id);
    }
    return { filterState, updateItem, removeItem };
}
