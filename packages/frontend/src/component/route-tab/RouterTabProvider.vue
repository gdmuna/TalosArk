<template>
    <slot />
</template>

<script setup lang="ts">
import { provideRouteTabContext } from './util';

provideRouteTabContext();
</script>

<style scoped></style>
