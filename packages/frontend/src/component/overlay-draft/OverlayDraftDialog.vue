<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/ui/dialog';
import { Button } from '@/ui/button';

withDefaults(defineProps<{ description?: string }>(), {
    description: '关闭后，本次尚未提交的更改会丢失。',
});
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ discard: [] }>();
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent>
            <DialogTitle>放弃未提交的更改？</DialogTitle>
            <DialogDescription>{{ description }}</DialogDescription>
            <DialogFooter>
                <Button variant="outline" @click="open = false">继续编辑</Button>
                <Button variant="destructive" @click="emit('discard')">放弃更改</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
