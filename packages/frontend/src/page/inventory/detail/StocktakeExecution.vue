<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ClipboardCheck, ScanLine, Save, Check } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import ResourceDetailPage from '../../resource/ResourceDetailPage.vue';
import { provideBreadcrumbs } from '@/component/breadcrumb';
import { useNavigationStore } from '@/platform/navigation';
import ResourceObjectHeader from '../../resource/ResourceObjectHeader.vue';
import ResourceViewNav from '../../resource/ResourceViewNav.vue';
import ResourceSection from '../../resource/ResourceSection.vue';
import ResourceFactList from '../../resource/ResourceFactList.vue';
import ResourceTable from '../../resource/ResourceTable.vue';
import ResourceEmpty from '../../resource/ResourceEmpty.vue';
import { useResourceView } from '../../resource/useResourceView';
const route = useRoute();
const taskId = computed(() => String(route.params.taskId));
const navigation = useNavigationStore();
const returnTo = computed(() => navigation.lastLocation('/main/inventory/stocktake'));
provideBreadcrumbs(() => [
    { id: 'stocktake-list', label: '盘点', to: returnTo.value },
    { id: 'stocktake-task', label: '盘点任务' },
]);
const tabs = [
    { id: 'prepare', label: '准备' },
    { id: 'count', label: '盘点' },
    { id: 'review', label: '差异复核' },
    { id: 'complete', label: '完成' },
];
const { view, select } = useResourceView(tabs.map((tab) => tab.id));
</script>
<template>
    <ResourceDetailPage label="盘点执行">
        <template #header>
            <ResourceObjectHeader
                :id="taskId"
                title="盘点任务"
                :icon="ClipboardCheck"
                :back-to="returnTo"
                back-label="盘点列表"
            >
                <Button variant="outline" disabled>
                    <Save aria-hidden="true" />
                    保存
                </Button>
                <Button disabled>
                    <Check aria-hidden="true" />
                    提交复核
                </Button>
            </ResourceObjectHeader>
            <ResourceViewNav :items="tabs" :active="view" label="盘点阶段视图" @select="select" />
        </template>
        <ResourceSection title="任务范围">
            <ResourceFactList
                :fields="[
                    { label: '任务名称' },
                    { label: '盘点范围' },
                    { label: '负责人' },
                    { label: '任务状态' },
                    { label: '开始时间' },
                    { label: '截止时间' },
                ]"
            />
        </ResourceSection>
        <ResourceSection v-if="view === 'prepare'" title="准备清单">
            <ResourceTable
                :fields="[
                    ['scope', '存储范围', 260],
                    ['expected', '预计实例', 120],
                    ['owner', '负责人', 120],
                    ['status', '准备状态', 140],
                ]"
            />
        </ResourceSection>
        <template v-else-if="view === 'count'">
            <div class="grid min-w-0 gap-8 @4xl:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
                <ResourceSection title="盘点记录">
                    <div class="flex gap-2">
                        <Input readonly aria-label="扫描实例或存储位置" placeholder="扫描实例或存储位置" />
                        <Button variant="outline" size="icon" use-tooltip title="扫描" disabled>
                            <ScanLine aria-hidden="true" />
                        </Button>
                    </div>
                    <ResourceTable
                        :fields="[
                            ['id', '实例 ID', 180],
                            ['position', '位置', 180],
                            ['expected', '账面数量', 120],
                            ['actual', '实盘数量', 120],
                            ['status', '盘点状态', 130],
                        ]"
                    />
                </ResourceSection>
                <ResourceSection title="当前记录">
                    <ResourceEmpty text="选择盘点记录" />
                    <div class="space-y-3">
                        <Label for="stocktake-count">实盘数量</Label>
                        <Input id="stocktake-count" type="number" readonly placeholder="未加载" />
                        <Button class="w-full" disabled>
                            <Check aria-hidden="true" />
                            确认记录
                        </Button>
                    </div>
                </ResourceSection>
            </div>
        </template>
        <ResourceSection v-else-if="view === 'review'" title="差异复核">
            <ResourceTable
                :fields="[
                    ['id', '实例 ID', 200],
                    ['expected', '账面数量', 120],
                    ['actual', '实盘数量', 120],
                    ['difference', '差异', 100],
                    ['reason', '差异原因', 240],
                    ['status', '复核状态', 130],
                ]"
            />
        </ResourceSection>
        <ResourceSection v-else title="盘点结果">
            <ResourceFactList
                :fields="[{ label: '已盘实例' }, { label: '差异数量' }, { label: '复核人' }, { label: '完成时间' }]"
            />
            <ResourceEmpty text="盘点结果未加载" />
        </ResourceSection>
    </ResourceDetailPage>
</template>
