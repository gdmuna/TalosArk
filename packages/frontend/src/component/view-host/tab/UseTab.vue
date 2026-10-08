<template>
    <slot
        :createTab="createTab"
        :tabEntity="tabEntity"
        :getTabEntity="getTabEntity"
        :activeTabId="activeTabId"
        :activeTabEntity="activeTabEntity"
        :setActiveTabId="setActiveTabId"
        :deleteTab="deleteTab"
    />
</template>

<script setup lang="ts">
import { useTab, type TabContextEntity } from './useTab';

const {
    createTab,
    tabEntity,
    getTabEntity,
    // updateTabEntity,
    activeTabId,
    activeTabEntity,
    setActiveTabId,
    deleteTab,
} = useTab();

defineSlots<{
    default(props: {
        /** 创建新 tab 并注册到 registry */
        createTab: () => TabContextEntity;
        /** 当前所有 tab 的数组（ComputedRef 的解包值） */
        tabEntity: TabContextEntity[];
        /** 按 id 获取单个 tab entity */
        getTabEntity: (tabId: string) => TabContextEntity;
        /** 当前活跃 tab 的 id，没有则为 null */
        activeTabId: string | null;
        /** 当前活跃 tab 的完整 entity */
        activeTabEntity: TabContextEntity | null;
        /** 将指定 tab 设为活跃 */
        setActiveTabId: (tabId: string) => void;
        /** 删除 tab，自动激活邻居 */
        deleteTab: (tabId: string | string[]) => void;
    }): any;
}>();
</script>

<style scoped></style>
