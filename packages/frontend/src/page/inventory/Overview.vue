<script setup lang="ts">
import { Package, LockKeyhole, TriangleAlert, ArrowLeftRight, ArrowUpRight } from '@lucide/vue';
import { useRouter } from 'vue-router';
import { Button } from '@/ui/button';
import ResourcePage from '../resource/ResourcePage.vue';
import ResourceSection from '../resource/ResourceSection.vue';
import ResourceSummary from '../resource/ResourceSummary.vue';
import ResourceEmpty from '../resource/ResourceEmpty.vue';
import ResourceTable from '../resource/ResourceTable.vue';
const router = useRouter();
</script>
<template>
    <ResourcePage label="库存概览">
        <ResourceSummary
            :items="[
                { label: '在库实例', icon: Package },
                { label: '已预留', icon: LockKeyhole },
                { label: '库存预警', icon: TriangleAlert },
                { label: '今日出入库', icon: ArrowLeftRight },
            ]"
        />
        <div class="grid min-w-0 gap-8 @4xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <ResourceSection title="近期出入库">
                <template #actions>
                    <Button variant="ghost" size="sm" @click="router.push('/main/inventory/transaction')">
                        全部流水
                        <ArrowUpRight aria-hidden="true" />
                    </Button>
                </template>
                <ResourceTable
                    :fields="[
                        ['time', '时间', 180],
                        ['type', '类型', 110],
                        ['material', '对象', 220],
                        ['quantity', '数量变化', 120],
                    ]"
                />
            </ResourceSection>
            <ResourceSection title="存储占用">
                <template #actions>
                    <Button variant="ghost" size="sm" @click="router.push('/main/inventory/storage-topology')">
                        存储浏览
                        <ArrowUpRight aria-hidden="true" />
                    </Button>
                </template>
                <ResourceEmpty text="位置与容量未加载" />
            </ResourceSection>
        </div>
        <div class="grid gap-8 @3xl:grid-cols-2">
            <ResourceSection title="库存风险">
                <template #actions>
                    <Button variant="ghost" size="sm" @click="router.push('/main/inventory/alert')">
                        查看预警
                        <ArrowUpRight aria-hidden="true" />
                    </Button>
                </template>
                <ResourceEmpty text="库存预警未加载" />
            </ResourceSection>
            <ResourceSection title="即将到期"><ResourceEmpty text="有效期数据未加载" /></ResourceSection>
        </div>
    </ResourcePage>
</template>
