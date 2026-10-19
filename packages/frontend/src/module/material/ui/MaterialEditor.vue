<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Plus, Trash2, Save } from '@lucide/vue';
import { MaterialWriteSchema, type Material, type MaterialBranch } from '@talos-ark/contracts/material';
import { useMaterialStore, materialErrorMessage } from '../model/store';
import { materialBranches, branchPresentation } from '../model/presentation';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/ui/sheet';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { ScrollArea } from '@/ui/scroll-area';
import { SelectField } from '@/component/select-field';

const props = defineProps<{ material?: Material }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ saved: [material: Material] }>();
const store = useMaterialStore();
const form = reactive({
    code: '',
    name: '',
    typeId: '',
    branch: 'consumable' as MaterialBranch,
    description: '',
    manufacturer: '',
    catalogNumber: '',
    quantityUnit: '',
    quantityScale: 6,
});
const attributes = reactive<Record<string, string>>({});
const aliases = ref('');
const identifiers = ref<{ scheme: string; value: string }[]>([]);
const error = ref('');
const typeError = ref('');
const title = computed(() => (props.material ? '编辑材料' : '新建材料'));
const typeOptions = computed(() =>
    store.types
        .filter((item) => !item.archivedAt || item.id === props.material?.typeId)
        .map((item) => ({ value: item.id, label: item.name + (item.archivedAt ? '（已归档）' : '') }))
);
const locked = computed(() => !!props.material?.instanceCount);
async function loadTypes() {
    typeError.value = '';
    try {
        await store.loadTypes();
    } catch (cause) {
        typeError.value = materialErrorMessage(cause);
    }
}
watch(open, (value) => {
    if (!value) return;
    const material = props.material;
    Object.assign(
        form,
        material
            ? {
                  code: material.code,
                  name: material.name,
                  typeId: material.typeId,
                  branch: material.branch,
                  description: material.description,
                  manufacturer: material.manufacturer,
                  catalogNumber: material.catalogNumber,
                  quantityUnit: material.quantityUnit,
                  quantityScale: material.quantityScale,
              }
            : {
                  code: '',
                  name: '',
                  typeId: '',
                  branch: 'consumable',
                  description: '',
                  manufacturer: '',
                  catalogNumber: '',
                  quantityUnit: '',
                  quantityScale: 6,
              }
    );
    for (const key of Object.keys(attributes)) delete attributes[key];
    if (material) Object.assign(attributes, material.attributes);
    aliases.value = material?.aliases.join('\n') ?? '';
    identifiers.value = material?.identifiers.map((item) => ({ ...item })) ?? [];
    error.value = store.error = '';
    void loadTypes();
});
watch(
    () => store.scope,
    () => {
        open.value = false;
    }
);
async function submit() {
    const profile = Object.fromEntries(
        branchPresentation(form.branch).fields.map((field) => [field.key, attributes[field.key] ?? ''])
    );
    const result = MaterialWriteSchema.safeParse({
        ...form,
        attributes: profile,
        aliases: aliases.value
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean),
        identifiers: identifiers.value,
    });
    if (!result.success) {
        error.value = '请检查：' + result.error.issues.map((issue) => issue.path.join('.')).join('、');
        return;
    }
    error.value = '';
    const material = props.material;
    const saved = await store.mutate(({ source, scope, signal }) =>
        material ? source.update(scope, material.id, result.data, signal) : source.create(scope, result.data, signal)
    );
    if (saved) {
        open.value = false;
        emit('saved', saved);
    }
}
</script>

<template>
    <Sheet v-model:open="open">
        <SheetContent
            class="w-full gap-0 p-0 sm:max-w-2xl"
            @interact-outside="store.busy && $event.preventDefault()"
            @escape-key-down="store.busy && $event.preventDefault()"
        >
            <div class="shrink-0 border-b p-6 pr-12">
                <SheetTitle>{{ title }}</SheetTitle>
                <SheetDescription class="sr-only">材料定义与分支属性</SheetDescription>
            </div>
            <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
                <ScrollArea class="min-h-0 flex-1">
                    <fieldset class="space-y-6 p-6" :disabled="store.busy">
                        <section class="space-y-4">
                            <h3 class="border-b pb-2 font-medium">基本信息</h3>
                            <div class="grid gap-4 sm:grid-cols-2">
                                <label class="space-y-2 text-sm">
                                    <span>材料编号 *</span>
                                    <Input v-model="form.code" maxlength="80" required />
                                </label>
                                <label class="space-y-2 text-sm">
                                    <span>材料名称 *</span>
                                    <Input v-model="form.name" maxlength="200" required />
                                </label>
                                <label class="space-y-2 text-sm">
                                    <span>业务分支 *</span>
                                    <SelectField
                                        v-model="form.branch"
                                        label="业务分支"
                                        :options="
                                            materialBranches.map((item) => ({ value: item.id, label: item.label }))
                                        "
                                        :disabled="store.busy || locked"
                                    />
                                </label>
                                <label class="space-y-2 text-sm">
                                    <span>材料分类 *</span>
                                    <SelectField
                                        v-model="form.typeId"
                                        label="材料分类"
                                        :options="typeOptions"
                                        :disabled="store.busy"
                                    />
                                </label>
                                <label class="space-y-2 text-sm">
                                    <span>计量单位 *</span>
                                    <Input v-model="form.quantityUnit" maxlength="32" :disabled="locked" required />
                                </label>
                                <label class="space-y-2 text-sm">
                                    <span>数量小数位数 *</span>
                                    <Input
                                        v-model.number="form.quantityScale"
                                        type="number"
                                        min="0"
                                        max="6"
                                        step="1"
                                        :disabled="locked"
                                        required
                                    />
                                </label>
                                <label class="space-y-2 text-sm">
                                    <span>厂家</span>
                                    <Input v-model="form.manufacturer" maxlength="200" />
                                </label>
                                <label class="space-y-2 text-sm">
                                    <span>货号</span>
                                    <Input v-model="form.catalogNumber" maxlength="200" />
                                </label>
                            </div>
                            <p v-if="!store.types.length && !typeError" class="text-sm text-muted-foreground">
                                请先在材料列表的“管理分类”中创建分类。
                            </p>
                            <p v-if="typeError" role="alert" class="text-sm text-destructive">
                                {{ typeError }}
                                <Button type="button" variant="link" size="sm" @click="loadTypes">重试</Button>
                            </p>
                            <label class="block space-y-2 text-sm">
                                <span>描述</span>
                                <Textarea v-model="form.description" rows="3" maxlength="4000" />
                            </label>
                        </section>
                        <section class="space-y-4">
                            <h3 class="border-b pb-2 font-medium">{{ branchPresentation(form.branch).label }}属性</h3>
                            <label
                                v-for="field in branchPresentation(form.branch).fields"
                                :key="field.key"
                                class="block space-y-2 text-sm"
                            >
                                <span>{{ field.label }}</span>
                                <Input v-model="attributes[field.key]" maxlength="200" />
                            </label>
                        </section>
                        <section class="space-y-4">
                            <h3 class="border-b pb-2 font-medium">别名与外部标识</h3>
                            <label class="block space-y-2 text-sm">
                                <span>别名（每行一项）</span>
                                <Textarea v-model="aliases" rows="3" />
                            </label>
                            <div v-for="(item, index) in identifiers" :key="index" class="flex items-center gap-2">
                                <Input
                                    v-model="item.scheme"
                                    class="w-28"
                                    aria-label="标识体系"
                                    placeholder="cas / rrid"
                                    maxlength="40"
                                    required
                                />
                                <Input
                                    v-model="item.value"
                                    class="min-w-0 flex-1"
                                    aria-label="标识值"
                                    maxlength="200"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    use-tooltip
                                    tooltip="移除此标识"
                                    aria-label="移除此标识"
                                    @click="identifiers.splice(index, 1)"
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                :disabled="identifiers.length >= 50"
                                @click="identifiers.push({ scheme: '', value: '' })"
                            >
                                <Plus />
                                添加外部标识
                            </Button>
                        </section>
                    </fieldset>
                </ScrollArea>
                <div class="shrink-0 space-y-3 border-t p-6">
                    <p v-if="error || store.error" role="alert" class="text-sm text-destructive">
                        {{ error || store.error }}
                    </p>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" :disabled="store.busy" @click="open = false">
                            取消
                        </Button>
                        <Button type="submit" :disabled="store.busy || !!typeError || !form.typeId">
                            <Save />
                            {{ store.busy ? '正在保存' : '保存材料' }}
                        </Button>
                    </div>
                </div>
            </form>
        </SheetContent>
    </Sheet>
</template>
