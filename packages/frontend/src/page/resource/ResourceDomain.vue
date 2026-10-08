<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { RouterTabBar, useRouteTab } from '@/component/route-tab';
import { ScrollSurface } from '@/component/scroll-surface';
import { resourceNavigation, type ResourceDomain } from '@/router/resource';

const props = defineProps<{ domain: ResourceDomain }>();
const route = useRoute();
useRouteTab().setEntity(
    resourceNavigation[props.domain].map((item) => ({
        id: item.path,
        value: { label: item.label, path: `/main/${props.domain}/${item.path}`, disabled: false },
    }))
);
// Object navigation belongs to the object header, not a second copy of the domain bar.
const isDetail = computed(() => route.meta.resourceDetail === true);
</script>

<template>
    <RouterTabBar v-if="!isDetail" />
    <ScrollSurface class="min-h-0 flex-1 scroll-smooth" edge-effect="line">
        <RouterView :key="route.path" />
    </ScrollSurface>
</template>
