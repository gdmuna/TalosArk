<template>
    <ScrollArea edges="horizontal" edge-effect="line" class="scroll-smooth bg-card">
        <ButtonGroup>
            <TabBarItem
                v-for="entity in tabEntity"
                :key="entity.id"
                :data-activated="entity.id === activeTabId"
                @click="handleSwitch(entity.id)"
                @close="handleDelete(entity.id)"
            >
                {{ getActiveEntry(entity.id).value?.title }}
            </TabBarItem>
        </ButtonGroup>
        <ScrollBar orientation="horizontal" class="h-2 z-10" />
    </ScrollArea>
</template>

<script setup lang="ts">
import TabBarItem from './TabBarItem.vue';
import { useTab } from '../tab/useTab';
import { useTabComponent } from '../tab/useTabComponent';
import { useViewHistory } from '../history/useViewHistory';
import { ButtonGroup } from '@/ui/button-group';
import { useRouter } from 'vue-router';
import { ScrollBar } from '@/ui/scroll-area';
import { ScrollSurface as ScrollArea } from '@/component/scroll-surface';

const { tabEntity, setActiveTabId, deleteTab, activeTabId } = useTab();

const { withSwitching } = useTabComponent();

const router = useRouter();

const { getActiveEntry } = useViewHistory();

function handleSwitch(tabId: string) {
    withSwitching(async () => {
        const entry = getActiveEntry(tabId).value;
        const nextPath = entry?.path ?? '/workbench/welcome';
        await router.push(nextPath);
        setActiveTabId(tabId);
    });
}

function handleDelete(tabId: string) {
    withSwitching(async () => {
        const { next } = deleteTab(tabId);
        const entry = getActiveEntry(next).value;
        const nextPath = entry?.path ?? '/workbench/welcome';
        await router.push(nextPath);
        setActiveTabId(next);
    });
}
</script>

<style scoped></style>
