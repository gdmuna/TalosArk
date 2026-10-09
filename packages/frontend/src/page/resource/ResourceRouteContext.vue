<script setup lang="ts">
import { useRoute } from 'vue-router';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import type { ResourceDomain } from '@/router/resource';

const props = defineProps<{ domain: ResourceDomain }>();
const route = useRoute();
provideBreadcrumbs(() => [
    { id: 'domain', label: String(route.meta.sectionLabel), to: `/main/${props.domain}/overview` },
    ...(!route.meta.resourceDetail ? [{ id: 'domain-view', label: String(route.meta.pageLabel) }] : []),
]);
</script>

<template><slot /></template>
