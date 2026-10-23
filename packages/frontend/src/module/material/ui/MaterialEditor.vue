<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch, useId } from 'vue';
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
import { OverlayDraftDialog, useOverlayDraft } from '@/component/overlay-draft';
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/ui/field';

const formFieldId = useId();

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
const {
    guardedOpen: dialogOpen,
    confirmOpen,
    discard,
} = useOverlayDraft(open, () => JSON.stringify([form, attributes, aliases.value, identifiers.value]), {
    busy: () => store.busy,
});
const typeError = ref('');
const title = computed(() => (props.material ? '编辑材料' : '新建材料'));
const typeOptions = computed(() =>
    store.types
        .filter((item) => !item.archivedAt || item.id === props.material?.typeId)
        .map((item) => ({ value: item.id, label: item.name + (item.archivedAt ? '（已归档）' : '') }))
);
const locked = computed(() => !!props.material?.instanceCount);
function focusFirstField(event: Event) {
    const input = formElement.value?.querySelector<HTMLInputElement>('input:not(:disabled)');
    if (input) {
        event.preventDefault();
        input.focus({ preventScroll: true });
    }
}
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
            @open-auto-focus="focusFirstField"
            @interact-outside="store.busy && $event.preventDefault()"
            @escape-key-down="store.busy && $event.preventDefault()"
        >
            <div class="shrink-0 border-b p-6 pr-12">
                <SheetTitle>{{ title }}</SheetTitle>
                <SheetDescription class="sr-only">材料定义与分支属性</SheetDescription>
            </div>
            <form ref="formElement" class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
                <ScrollArea class="min-h-0 flex-1">
                    <FieldSet class="gap-8 p-6 [&_[data-slot=select-trigger]]:w-full" :disabled="store.busy">
                        <FieldSet class="gap-5">
                            <FieldLegend class="mb-5 w-full border-b pb-3 text-sm">基本信息</FieldLegend>
                            <FieldGroup class="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                                <Field :data-invalid="validation?.field === 'name' || undefined" data-field="name">
                                    <FieldLabel :for="formFieldId + '-2'">材料名称 *</FieldLabel>
                                    <Input
                                        :id="formFieldId + '-2'"
                                        v-model="form.name"
                                        :aria-describedby="
                                            validation?.field === 'name' ? formFieldId + '-2' + '-error' : undefined
                                        "
                                        :aria-invalid="validation?.field === 'name' || undefined"
                                        maxlength="200"
                                        required
                                    />
                                    <FieldError
                                        v-if="validation?.field === 'name'"
                                        :id="formFieldId + '-2' + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                                <Field :data-invalid="validation?.field === 'code' || undefined" data-field="code">
                                    <FieldLabel :for="formFieldId + '-1'">材料编号 *</FieldLabel>
                                    <Input
                                        :id="formFieldId + '-1'"
                                        v-model="form.code"
                                        :aria-describedby="
                                            validation?.field === 'code' ? formFieldId + '-1' + '-error' : undefined
                                        "
                                        :aria-invalid="validation?.field === 'code' || undefined"
                                        maxlength="80"
                                        required
                                    />
                                    <FieldError
                                        v-if="validation?.field === 'code'"
                                        :id="formFieldId + '-1' + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                                <Field :data-invalid="validation?.field === 'branch' || undefined" data-field="branch">
                                    <FieldLabel :for="formFieldId + '-3'">业务分支 *</FieldLabel>
                                    <SelectField
                                        :id="formFieldId + '-3'"
                                        v-model="form.branch"
                                        :aria-describedby="
                                            validation?.field === 'branch' ? formFieldId + '-3' + '-error' : undefined
                                        "
                                        :aria-invalid="validation?.field === 'branch' || undefined"
                                        label="业务分支"
                                        :options="
                                            materialBranches.map((item) => ({ value: item.id, label: item.label }))
                                        "
                                        :disabled="store.busy || locked"
                                    />
                                    <FieldError
                                        v-if="validation?.field === 'branch'"
                                        :id="formFieldId + '-3' + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                                <Field :data-invalid="validation?.field === 'typeId' || undefined" data-field="typeId">
                                    <FieldLabel :for="formFieldId + '-4'">材料分类 *</FieldLabel>
                                    <SelectField
                                        :id="formFieldId + '-4'"
                                        v-model="form.typeId"
                                        :aria-describedby="
                                            validation?.field === 'typeId' ? formFieldId + '-4' + '-error' : undefined
                                        "
                                        :aria-invalid="validation?.field === 'typeId' || undefined"
                                        label="材料分类"
                                        :options="typeOptions"
                                        :disabled="store.busy"
                                    />
                                    <FieldError
                                        v-if="validation?.field === 'typeId'"
                                        :id="formFieldId + '-4' + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                            </FieldGroup>
                            <p v-if="!store.types.length && !typeError" class="text-sm text-muted-foreground">
                                请先在材料列表的“管理分类”中创建分类。
                            </p>
                            <FieldError v-if="typeError" role="alert" class="text-sm text-destructive">
                                {{ typeError }}
                                <Button type="button" variant="link" size="sm" @click="loadTypes">重试</Button>
                            </FieldError>
                            <Field
                                :data-invalid="validation?.field === 'description' || undefined"
                                data-field="description"
                            >
                                <FieldLabel :for="formFieldId + '-9'">描述</FieldLabel>
                                <Textarea
                                    :id="formFieldId + '-9'"
                                    v-model="form.description"
                                    :aria-describedby="
                                        validation?.field === 'description' ? formFieldId + '-9' + '-error' : undefined
                                    "
                                    :aria-invalid="validation?.field === 'description' || undefined"
                                    rows="3"
                                    maxlength="4000"
                                />
                                <FieldError
                                    v-if="validation?.field === 'description'"
                                    :id="formFieldId + '-9' + '-error'"
                                    class="text-destructive"
                                >
                                    {{ validation.message }}
                                </FieldError>
                            </Field>
                        </FieldSet>
                        <FieldSet class="gap-5">
                            <FieldLegend class="mb-5 w-full border-b pb-3 text-sm">计量与来源</FieldLegend>
                            <FieldGroup class="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                                <Field
                                    :data-invalid="validation?.field === 'quantityUnit' || undefined"
                                    data-field="quantityUnit"
                                >
                                    <FieldLabel :for="formFieldId + '-5'">计量单位 *</FieldLabel>
                                    <Input
                                        :id="formFieldId + '-5'"
                                        v-model="form.quantityUnit"
                                        :aria-describedby="
                                            validation?.field === 'quantityUnit'
                                                ? formFieldId + '-5' + '-error'
                                                : undefined
                                        "
                                        :aria-invalid="validation?.field === 'quantityUnit' || undefined"
                                        maxlength="32"
                                        :disabled="locked"
                                        required
                                    />
                                    <FieldError
                                        v-if="validation?.field === 'quantityUnit'"
                                        :id="formFieldId + '-5' + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                                <Field
                                    class="max-w-40"
                                    :data-invalid="validation?.field === 'quantityScale' || undefined"
                                    data-field="quantityScale"
                                >
                                    <FieldLabel :for="formFieldId + '-6'">数量小数位数 *</FieldLabel>
                                    <Input
                                        :id="formFieldId + '-6'"
                                        v-model.number="form.quantityScale"
                                        :aria-describedby="
                                            validation?.field === 'quantityScale'
                                                ? formFieldId + '-6' + '-error'
                                                : undefined
                                        "
                                        :aria-invalid="validation?.field === 'quantityScale' || undefined"
                                        type="number"
                                        min="0"
                                        max="6"
                                        step="1"
                                        :disabled="locked"
                                        required
                                    />
                                    <FieldError
                                        v-if="validation?.field === 'quantityScale'"
                                        :id="formFieldId + '-6' + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                                <Field
                                    :data-invalid="validation?.field === 'manufacturer' || undefined"
                                    data-field="manufacturer"
                                >
                                    <FieldLabel :for="formFieldId + '-7'">厂家</FieldLabel>
                                    <Input
                                        :id="formFieldId + '-7'"
                                        v-model="form.manufacturer"
                                        :aria-describedby="
                                            validation?.field === 'manufacturer'
                                                ? formFieldId + '-7' + '-error'
                                                : undefined
                                        "
                                        :aria-invalid="validation?.field === 'manufacturer' || undefined"
                                        maxlength="200"
                                    />
                                    <FieldError
                                        v-if="validation?.field === 'manufacturer'"
                                        :id="formFieldId + '-7' + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                                <Field
                                    :data-invalid="validation?.field === 'catalogNumber' || undefined"
                                    data-field="catalogNumber"
                                >
                                    <FieldLabel :for="formFieldId + '-8'">货号</FieldLabel>
                                    <Input
                                        :id="formFieldId + '-8'"
                                        v-model="form.catalogNumber"
                                        :aria-describedby="
                                            validation?.field === 'catalogNumber'
                                                ? formFieldId + '-8' + '-error'
                                                : undefined
                                        "
                                        :aria-invalid="validation?.field === 'catalogNumber' || undefined"
                                        maxlength="200"
                                    />
                                    <FieldError
                                        v-if="validation?.field === 'catalogNumber'"
                                        :id="formFieldId + '-8' + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                            </FieldGroup>
                        </FieldSet>
                        <FieldSet class="gap-5">
                            <FieldLegend class="mb-5 w-full border-b pb-3 text-sm">
                                {{ branchPresentation(form.branch).label }}属性
                            </FieldLegend>
                            <FieldGroup class="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                                <Field
                                    v-for="field in branchPresentation(form.branch).fields"
                                    :key="field.key"
                                    class="sm:last:col-span-2"
                                    :data-invalid="validation?.field === `attributes.${field.key}` || undefined"
                                    :data-field="`attributes.${field.key}`"
                                >
                                    <FieldLabel :for="formFieldId + '-10' + '-' + field.key">
                                        {{ field.label }}
                                    </FieldLabel>
                                    <Input
                                        :id="formFieldId + '-10' + '-' + field.key"
                                        v-model="attributes[field.key]"
                                        :aria-describedby="
                                            validation?.field === `attributes.${field.key}`
                                                ? formFieldId + '-10' + '-' + field.key + '-error'
                                                : undefined
                                        "
                                        :aria-invalid="validation?.field === `attributes.${field.key}` || undefined"
                                        :maxlength="
                                            ['species', 'molecularFormula', 'physicalForm'].includes(field.key)
                                                ? 200
                                                : 300
                                        "
                                    />
                                    <FieldError
                                        v-if="validation?.field === `attributes.${field.key}`"
                                        :id="formFieldId + '-10' + '-' + field.key + '-error'"
                                        class="text-destructive"
                                    >
                                        {{ validation.message }}
                                    </FieldError>
                                </Field>
                            </FieldGroup>
                        </FieldSet>
                        <FieldSet class="gap-5">
                            <FieldLegend class="mb-5 w-full border-b pb-3 text-sm">别名与外部标识</FieldLegend>
                            <Field :data-invalid="validation?.field === 'aliases' || undefined" data-field="aliases">
                                <FieldLabel :for="formFieldId + '-11'">别名（每行一项）</FieldLabel>
                                <Textarea
                                    :id="formFieldId + '-11'"
                                    v-model="aliases"
                                    :aria-describedby="
                                        validation?.field === 'aliases' ? formFieldId + '-11' + '-error' : undefined
                                    "
                                    :aria-invalid="validation?.field === 'aliases' || undefined"
                                    rows="3"
                                />
                                <FieldError
                                    v-if="validation?.field === 'aliases'"
                                    :id="formFieldId + '-11' + '-error'"
                                    class="text-destructive"
                                >
                                    {{ validation.message }}
                                </FieldError>
                            </Field>
                            <FieldSet
                                data-field="identifiers"
                                :data-invalid="validation?.field === 'identifiers' || undefined"
                            >
                                <FieldLegend variant="label">外部标识</FieldLegend>
                                <FieldGroup class="gap-4">
                                    <div
                                        v-for="(item, index) in identifiers"
                                        :key="index"
                                        class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-start gap-3"
                                    >
                                        <Field
                                            :data-invalid="
                                                validation?.field === 'identifiers.' + index + '.scheme' || undefined
                                            "
                                        >
                                            <FieldLabel :for="formFieldId + '-identifier-' + index + '-scheme'">
                                                标识体系
                                            </FieldLabel>
                                            <Input
                                                :id="formFieldId + '-identifier-' + index + '-scheme'"
                                                v-model="item.scheme"
                                                :data-field="'identifiers.' + index + '.scheme'"
                                                placeholder="cas / rrid"
                                                maxlength="40"
                                                required
                                                :aria-invalid="
                                                    validation?.field === 'identifiers.' + index + '.scheme' ||
                                                    undefined
                                                "
                                                :aria-describedby="
                                                    validation?.field === 'identifiers.' + index + '.scheme'
                                                        ? formFieldId + '-identifier-' + index + '-error'
                                                        : undefined
                                                "
                                            />
                                        </Field>
                                        <Field
                                            :data-invalid="
                                                validation?.field === 'identifiers.' + index + '.value' || undefined
                                            "
                                        >
                                            <FieldLabel :for="formFieldId + '-identifier-' + index + '-value'">
                                                标识值
                                            </FieldLabel>
                                            <Input
                                                :id="formFieldId + '-identifier-' + index + '-value'"
                                                v-model="item.value"
                                                :data-field="'identifiers.' + index + '.value'"
                                                maxlength="200"
                                                required
                                                :aria-invalid="
                                                    validation?.field === 'identifiers.' + index + '.value' || undefined
                                                "
                                                :aria-describedby="
                                                    validation?.field === 'identifiers.' + index + '.value'
                                                        ? formFieldId + '-identifier-' + index + '-error'
                                                        : undefined
                                                "
                                            />
                                        </Field>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            class="mt-7"
                                            use-tooltip
                                            tooltip="移除此标识"
                                            aria-label="移除此标识"
                                            @click="identifiers.splice(index, 1)"
                                        >
                                            <Trash2 />
                                        </Button>
                                        <FieldError
                                            v-if="validation?.field.startsWith('identifiers.' + index + '.')"
                                            :id="formFieldId + '-identifier-' + index + '-error'"
                                            class="col-span-full"
                                        >
                                            {{ validation.message }}
                                        </FieldError>
                                    </div>
                                </FieldGroup>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    class="self-start"
                                    :disabled="identifiers.length >= 50"
                                    @click="identifiers.push({ scheme: '', value: '' })"
                                >
                                    <Plus />
                                    添加外部标识
                                </Button>
                                <FieldError v-if="validation?.field === 'identifiers'">
                                    {{ validation.message }}
                                </FieldError>
                            </FieldSet>
                        </FieldSet>
                    </FieldSet>
                </ScrollArea>
                <div class="shrink-0 space-y-3 border-t p-6">
                    <FieldError
                        v-if="!validation && (error || store.error)"
                        role="alert"
                        class="text-sm text-destructive"
                    >
                        {{ error || store.error }}
                    </FieldError>
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
    <OverlayDraftDialog v-model:open="confirmOpen" @discard="discard" />
</template>
