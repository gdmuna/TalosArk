<script setup lang="ts">
import { FlaskConical, Microscope, ClipboardCheck, Plus, ArrowUpRight } from '@lucide/vue';
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
    <ResourcePage label="材料概览">
        <ResourceSummary
            :items="[
                { label: '材料总数', icon: FlaskConical },
                { label: '活跃培养物', icon: Microscope },
                { label: '待检验', icon: ClipboardCheck },
            ]"
        />
        <div class="grid min-w-0 gap-8 @4xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <ResourceSection title="最近材料变更">
                <template #actions>
                    <Button variant="ghost" size="sm" @click="router.push('/main/material/list')">
                        材料列表
                        <ArrowUpRight aria-hidden="true" />
                    </Button>
                </template>
                <ResourceTable
                    :fields="[
                        ['material', '材料', 220],
                        ['change', '变更', 140],
                        ['operator', '操作人', 120],
                        ['time', '时间', 180],
                    ]"
                />
            </ResourceSection>
            <div class="space-y-8">
                <ResourceSection title="材料分布"><ResourceEmpty text="分类统计未加载" /></ResourceSection>
                <ResourceSection title="待检验材料"><ResourceEmpty text="检验任务未加载" /></ResourceSection>
            </div>
        </div>
        <ResourceSection title="快速操作">
            <div class="flex flex-wrap gap-2">
                <Button variant="outline" disabled>
                    <Plus aria-hidden="true" />
                    新建材料
                </Button>
                <Button variant="outline" disabled>
                    <Microscope aria-hidden="true" />
                    登记培养物
                </Button>
                <Button variant="outline" disabled>
                    <ClipboardCheck aria-hidden="true" />
                    登记检验
                </Button>
            </div>
        </ResourceSection>
    </ResourcePage>
</template>
