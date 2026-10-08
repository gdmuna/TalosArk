<template>
    <div class="flex flex-col m-auto gap-4 p-4">
        <h1>组织</h1>
        <div class="flex gap-4">
            <Input v-model="input1" placeholder="Type something..." />
            <Button @click="Alert(input1)">log</Button>
        </div>
        <div class="flex gap-4">
            <Input v-model="input2" placeholder="Type something..." />
            <Button @click="Alert(input2)">log</Button>
        </div>
        <div class="flex gap-4">
            <Input v-model="input3" placeholder="Type something..." />
            <Button @click="Alert(input3)">log</Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { onMounted, onUnmounted } from 'vue';

const input1 = defineModel('input1', { default: 'Hello, World!' });
const input2 = defineModel('input2', { default: '' });
const input3 = defineModel('input3', { default: '' });

function Alert(payload: any) {
    alert(payload);
}

onMounted(() => {
    console.log('Component <WorkbenchDashboard> mounted');
});

onUnmounted(() => {
    console.log('Component <WorkbenchDashboard> unmounted');
});
</script>

<style scoped></style>
