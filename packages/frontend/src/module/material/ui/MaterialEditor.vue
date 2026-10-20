<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/ui/dialog';

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
const validation = ref<{ field: string; message: string }>();
const formElement = ref<HTMLFormElement>();
const discardOpen = ref(false);
const draft = () => JSON.stringify([form, attributes, aliases.value, identifiers.value]);
const initialDraft = ref('');
const dialogOpen = computed({
    get: () => open.value,
    set: (value) => {
        if (store.busy) return;
        if (!value && draft() !== initialDraft.value) discardOpen.value = true;
        else open.value = value;
    },
});
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
    validation.value = undefined;
    discardOpen.value = false;
    initialDraft.value = draft();
    void loadTypes();
});
watch(
    () => store.scope,
    () => {
        discardOpen.value = false;
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
        const issue = result.error.issues[0];
        if (!issue) return;
        const field = issue.path.join('.');
        const labels: Record<string, string> = {
            code: '材料编号',
            name: '材料名称',
            typeId: '材料分类',
            quantityUnit: '计量单位',
            quantityScale: '数量小数位数',
            description: '描述',
            manufacturer: '厂家',
            catalogNumber: '货号',
            branch: '业务分支',
            aliases: '别名',
            identifiers: '外部标识',
        };
        const label = labels[String(issue.path[0])] ?? '材料属性';
        const message =
            field === 'identifiers'
                ? '外部标识重复，请删除重复的标识体系与标识值组合。'
                : field === 'aliases'
                  ? '别名不能重复，最多 40 项，每项不超过 200 字。'
                  : field.endsWith('.scheme')
                    ? '标识体系须以英文字母开头，仅含字母、数字、点、下划线或短横线。'
                    : `请检查${label}的内容、长度与格式。`;
        validation.value = { field, message };
        error.value = message;
        await nextTick();
        const container = formElement.value?.querySelector<HTMLElement>(`[data-field="${field}"]`);
        const target = container?.matches('input, textarea, button')
            ? container
            : container?.querySelector<HTMLElement>('input, textarea, button[role="combobox"]');
        target?.focus();
        return;
    }
    validation.value = undefined;
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
    <Sheet v-model:open="dialogOpen">
        <SheetContent
            class="w-full gap-0 p-0 sm:max-w-2xl"
            @interact-outside="store.busy && $event.preventDefault()"
            @escape-key-down="store.busy && $event.preventDefault()"
        >
            <div class="shrink-0 border-b p-6 pr-12">
                <SheetTitle>{{ title }}</SheetTitle>
                <SheetDescription class="sr-only">材料定义与分支属性</SheetDescription>
            </div>
            <form ref="formElement" class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
                <ScrollArea class="min-h-0 flex-1">
                    <fieldset class="space-y-6 p-6 [&_[data-slot=select-trigger]]:w-full" :disabled="store.busy">
                        <section class="space-y-4">
                            <h3 class="border-b pb-2 font-medium">基本信息</h3>
                            <div class="grid gap-4 sm:grid-cols-2">
                                <label data-field="code" class="space-y-2 text-sm">
                                    <span>材料编号 *</span>
                                    <Input v-model="form.code" maxlength="80" required />
                                    <p v-if="validation?.field === 'code'" class="text-destructive" aria-hidden="true">
                                        {{ validation.message }}
                                    </p>
                                </label>
                                <label data-field="name" class="space-y-2 text-sm">
                                    <span>材料名称 *</span>
                                    <Input v-model="form.name" maxlength="200" required />
                                    <p v-if="validation?.field === 'name'" class="text-destructive" aria-hidden="true">
                                        {{ validation.message }}
                                    </p>
                                </label>
                                <label data-field="branch" class="space-y-2 text-sm">
                                    <span>业务分支 *</span>
                                    <SelectField
                                        v-model="form.branch"
                                        label="业务分支"
                                        :options="
                                            materialBranches.map((item) => ({ value: item.id, label: item.label }))
                                        "
                                        :disabled="store.busy || locked"
                                    />
                                    <p
                                        v-if="validation?.field === 'branch'"
                                        class="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {{ validation.message }}
                                    </p>
                                </label>
                                <label data-field="typeId" class="space-y-2 text-sm">
                                    <span>材料分类 *</span>
                                    <SelectField
                                        v-model="form.typeId"
                                        label="材料分类"
                                        :options="typeOptions"
                                        :disabled="store.busy"
                                    />
                                    <p
                                        v-if="validation?.field === 'typeId'"
                                        class="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {{ validation.message }}
                                    </p>
                                </label>
                                <label data-field="quantityUnit" class="space-y-2 text-sm">
                                    <span>计量单位 *</span>
                                    <Input v-model="form.quantityUnit" maxlength="32" :disabled="locked" required />
                                    <p
                                        v-if="validation?.field === 'quantityUnit'"
                                        class="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {{ validation.message }}
                                    </p>
                                </label>
                                <label data-field="quantityScale" class="space-y-2 text-sm">
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
                                    <p
                                        v-if="validation?.field === 'quantityScale'"
                                        class="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {{ validation.message }}
                                    </p>
                                </label>
                                <label data-field="manufacturer" class="space-y-2 text-sm">
                                    <span>厂家</span>
                                    <Input v-model="form.manufacturer" maxlength="200" />
                                    <p
                                        v-if="validation?.field === 'manufacturer'"
                                        class="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {{ validation.message }}
                                    </p>
                                </label>
                                <label data-field="catalogNumber" class="space-y-2 text-sm">
                                    <span>货号</span>
                                    <Input v-model="form.catalogNumber" maxlength="200" />
                                    <p
                                        v-if="validation?.field === 'catalogNumber'"
                                        class="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {{ validation.message }}
                                    </p>
                                </label>
                            </div>
                            <p v-if="!store.types.length && !typeError" class="text-sm text-muted-foreground">
                                请先在材料列表的“管理分类”中创建分类。
                            </p>
                            <p v-if="typeError" role="alert" class="text-sm text-destructive">
                                {{ typeError }}
                                <Button type="button" variant="link" size="sm" @click="loadTypes">重试</Button>
                            </p>
                            <label data-field="description" class="block space-y-2 text-sm">
                                <span>描述</span>
                                <Textarea v-model="form.description" rows="3" maxlength="4000" />
                                <p
                                    v-if="validation?.field === 'description'"
                                    class="text-destructive"
                                    aria-hidden="true"
                                >
                                    {{ validation.message }}
                                </p>
                            </label>
                        </section>
                        <section class="space-y-4">
                            <h3 class="border-b pb-2 font-medium">{{ branchPresentation(form.branch).label }}属性</h3>
                            <label
                                v-for="field in branchPresentation(form.branch).fields"
                                :key="field.key"
                                :data-field="`attributes.${field.key}`"
                                class="block space-y-2 text-sm"
                            >
                                <span>{{ field.label }}</span>
                                <Input
                                    v-model="attributes[field.key]"
                                    :maxlength="
                                        ['species', 'molecularFormula', 'physicalForm'].includes(field.key) ? 200 : 300
                                    "
                                />
                                <p
                                    v-if="validation?.field === `attributes.${field.key}`"
                                    class="text-destructive"
                                    aria-hidden="true"
                                >
                                    {{ validation.message }}
                                </p>
                            </label>
                        </section>
                        <section class="space-y-4">
                            <h3 class="border-b pb-2 font-medium">别名与外部标识</h3>
                            <label data-field="aliases" class="block space-y-2 text-sm">
                                <span>别名（每行一项）</span>
                                <Textarea v-model="aliases" rows="3" />
                                <p v-if="validation?.field === 'aliases'" class="text-destructive" aria-hidden="true">
                                    {{ validation.message }}
                                </p>
                            </label>
                            <div data-field="identifiers" class="space-y-3">
                                <div v-for="(item, index) in identifiers" :key="index" class="space-y-2">
                                    <div class="flex items-center gap-2">
                                        <Input
                                            v-model="item.scheme"
                                            :data-field="`identifiers.${index}.scheme`"
                                            class="w-28"
                                            aria-label="标识体系"
                                            placeholder="cas / rrid"
                                            maxlength="40"
                                            required
                                        />
                                        <Input
                                            v-model="item.value"
                                            :data-field="`identifiers.${index}.value`"
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
                                    <p
                                        v-if="validation?.field.startsWith(`identifiers.${index}.`)"
                                        class="text-sm text-destructive"
                                    >
                                        {{ validation.message }}
                                    </p>
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
                                <p v-if="validation?.field === 'identifiers'" class="text-sm text-destructive">
                                    {{ validation.message }}
                                </p>
                            </div>
                        </section>
                    </fieldset>
                </ScrollArea>
                <div class="shrink-0 space-y-3 border-t p-6">
                    <p v-if="error || store.error" role="alert" class="text-sm text-destructive">
                        {{ error || store.error }}
                    </p>
                    <div class="flex justify-end gap-2">
                        <Button type="button" variant="outline" :disabled="store.busy" @click="dialogOpen = false">
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
    <Dialog v-model:open="discardOpen">
        <DialogContent>
            <DialogTitle>放弃未保存的材料信息？</DialogTitle>
            <DialogDescription>关闭后，本次尚未保存的内容会丢失。</DialogDescription>
            <DialogFooter>
                <Button variant="outline" @click="discardOpen = false">继续编辑</Button>
                <Button
                    variant="destructive"
                    @click="
                        discardOpen = false;
                        open = false;
                    "
                >
                    放弃更改
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
