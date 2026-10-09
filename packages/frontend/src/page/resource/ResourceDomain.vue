<script setup lang="ts">
import { RouterTabBar, useRouteTab } from '@/component/route-tab';
import { ScrollSurface } from '@/component/scroll-surface';
import { resourceNavigation, type ResourceDomain } from '@/router/resource';
import ResourceRouteContext from './ResourceRouteContext.vue';

const props = defineProps<{ domain: ResourceDomain }>();
useRouteTab().setEntity(
    resourceNavigation[props.domain].map((item) => ({
        id: item.path,
        value: { label: item.label, path: `/main/${props.domain}/${item.path}`, disabled: false },
    }))
);
</script>

<template>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <RouterView v-slot="{ Component, route: pageRoute }">
            <div
                v-if="Component"
                :key="pageRoute.path"
                class="flex min-h-0 min-w-0 flex-1 flex-col"
                data-slot="route-page"
            >
                <ResourceRouteContext :domain="domain">
                    <component :is="Component" v-if="pageRoute.meta.resourceDetail" />
                    <template v-else>
                        <RouterTabBar>
                            <template v-if="$slots.actions" #actions><slot name="actions" /></template>
                        </RouterTabBar>
                        <ScrollSurface class="min-h-0 flex-1 scroll-smooth" edge-effect="line">
                            <component :is="Component" />
                        </ScrollSurface>
                    </template>
                </ResourceRouteContext>
            </div>
        </RouterView>
    </div>
</template>
