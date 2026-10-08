import { computed } from 'vue';

import { useTitle as _useTitle } from '@vueuse/core';

import { useTab } from './tab/useTab';
import { useViewHistory } from './history/useViewHistory';

export function useTitle() {
    const { activeTabId } = useTab();
    const { getActiveEntry } = useViewHistory();
    const title = computed(() => getActiveEntry(activeTabId).value?.title);

    // const setTitle = (
    //     title: string,
    //     opts?: {
    //         tabId?: string
    //     }
    // ) => {
    //     const {
    //         tabId = activeTabId.value
    //     } = opts ?? {};
    //     let ok = false;
    //     ok = setViewHistoryTitle(tabId, title)
    //     if (!ok) return false;
    //     ok = setTabTitle(tabId, title)
    //     if (!ok) return false;
    //     return true;
    // }

    return {
        // setTitle,
        title,
    };
}
