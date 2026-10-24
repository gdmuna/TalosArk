<script setup lang="ts">
import ActivityList from './ActivityList.vue';
import type { useDetailActivity } from './read';
defineProps<{ activity: ReturnType<typeof useDetailActivity> }>();
</script>
<template>
    <ActivityList
        :items="activity.items.value"
        :loading="activity.loading.value"
        :error="activity.error.value"
        :has-more="!!activity.nextCursor.value"
        @retry="activity.refresh"
        @more="activity.more"
    />
</template>
