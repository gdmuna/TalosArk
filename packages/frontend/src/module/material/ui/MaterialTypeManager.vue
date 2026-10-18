<script setup lang="ts">
import { ref, watch } from 'vue';
import { Plus, Pencil, Archive, ArchiveRestore, Save, X } from '@lucide/vue';
import { MaterialTypeWriteSchema, type MaterialType } from '@talos-ark/contracts/material';
import { useMaterialStore } from '../model/store';
import { useMaterialRead } from '../model/useMaterialRead';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/ui/sheet';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';

const open = defineModel<boolean>('open', { default: false });
const store = useMaterialStore();
const code = ref(''),
    name = ref(''),
    editId = ref(''),
    validation = ref('');
const { data, loading, error, reload } = useMaterialRead((context, signal) =>
    context.source.types(context.scope, signal)
);
watch(data, (value) => {
    if (value) {
        store.types = value.items;
        store.capabilities = value.capabilities;
    }
});
watch(
    () => store.scope,
    () => {
        open.value = false;
        clear();
    }
);
function clear() {
    code.value = name.value = editId.value = validation.value = '';
}
function edit(item: MaterialType) {
    code.value = item.code;
    name.value = item.name;
    editId.value = item.id;
    validation.value = '';
}
async function submit() {
    const input = MaterialTypeWriteSchema.safeParse({ code: code.value, name: name.value });
    if (!input.success) {
        validation.value = '请填写有效的分类编号和名称';
        return;
    }
    const result = await store.mutate(({ source, scope, signal }) =>
        editId.value
            ? source.updateType(scope, editId.value, input.data, signal)
            : source.createType(scope, input.data, signal)
    );
    if (result) clear();
}
async function archive(item: MaterialType) {
    await store.mutate(({ source, scope, signal }) => source.archiveType(scope, item.id, !item.archivedAt, signal));
}
</script>
<template>
    <Sheet v-model:open="open">
        <SheetContent class="w-full gap-0 p-0 sm:max-w-xl">
            <div class="shrink-0 border-b p-6 pr-12">
                <SheetTitle>管理材料分类</SheetTitle>
                <SheetDescription class="sr-only">当前工作区的平面材料分类</SheetDescription>
            </div>
            <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-6 p-6">
                    <form class="space-y-4" @submit.prevent="submit">
                        <h3 class="font-medium">{{ editId ? '编辑分类' : '新建分类' }}</h3>
                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="space-y-2 text-sm">
                                <span>分类编号</span>
                                <Input v-model="code" maxlength="80" required :disabled="store.busy" />
                            </label>
                            <label class="space-y-2 text-sm">
                                <span>分类名称</span>
                                <Input v-model="name" maxlength="200" required :disabled="store.busy" />
                            </label>
                        </div>
                        <p v-if="validation || store.error" role="alert" class="text-sm text-destructive">
                            {{ validation || store.error }}
                        </p>
                        <div class="flex justify-end gap-2">
                            <Button v-if="editId" type="button" variant="outline" :disabled="store.busy" @click="clear">
                                <X />
                                取消编辑
                            </Button>
                            <Button type="submit" :disabled="store.busy || !data?.capabilities.manageType">
                                <component :is="editId ? Save : Plus" />
                                {{ editId ? '保存分类' : '新建分类' }}
                            </Button>
                        </div>
                    </form>
                    <div v-if="error" role="alert" class="space-y-2 text-sm">
                        <p class="text-destructive">{{ error }}</p>
                        <Button variant="outline" @click="reload">重新加载</Button>
                    </div>
                    <p v-else-if="loading" class="py-8 text-center text-sm text-muted-foreground">正在加载分类</p>
                    <p v-else-if="!data?.items.length" class="py-8 text-center text-sm text-muted-foreground">
                        尚未创建材料分类
                    </p>
                    <ul v-else class="divide-y border-y">
                        <li v-for="item in data.items" :key="item.id" class="flex items-center gap-3 py-3">
                            <div class="min-w-0 flex-1">
                                <p class="break-words font-medium">
                                    {{ item.name }}
                                    <span v-if="item.archivedAt" class="text-xs font-normal text-muted-foreground">
                                        已归档
                                    </span>
                                </p>
                                <p class="mt-1 break-all font-mono text-xs text-muted-foreground">{{ item.code }}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                use-tooltip
                                tooltip="编辑分类"
                                :disabled="store.busy || !!item.archivedAt || !data.capabilities.manageType"
                                @click="edit(item)"
                            >
                                <Pencil />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                use-tooltip
                                :tooltip="item.archivedAt ? '恢复分类' : '归档分类'"
                                :disabled="store.busy || !data.capabilities.manageType"
                                @click="archive(item)"
                            >
                                <component :is="item.archivedAt ? ArchiveRestore : Archive" />
                            </Button>
                        </li>
                    </ul>
                </div>
            </ScrollArea>
        </SheetContent>
    </Sheet>
</template>
