<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/ui/dialog';
import { Button } from '@/ui/button';
defineProps<{ open: boolean }>();
const emit = defineEmits<{ decide: [leave: boolean] }>();
</script>
<template>
    <Dialog
        :open="open"
        @update:open="
            (value) => {
                if (!value) emit('decide', false);
            }
        "
    >
        <DialogContent>
            <DialogHeader>
                <DialogTitle>放弃未保存的更改？</DialogTitle>
                <DialogDescription>离开当前视图后，未保存的模拟更改会丢失。</DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" @click="emit('decide', false)">继续编辑</Button>
                <Button variant="destructive" @click="emit('decide', true)">放弃并离开</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
