<script setup lang="ts">
import { Monitor, Wifi, TriangleAlert, ArrowUpRight } from '@lucide/vue';
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
    <ResourcePage label="设备概览">
        <ResourceSummary
            :items="[
                { label: '设备总数', icon: Monitor },
                { label: '在线设备', icon: Wifi },
                { label: '待处理告警', icon: TriangleAlert },
            ]"
        />
        <div class="grid min-w-0 gap-8 @4xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <ResourceSection title="设备健康状态">
                <template #actions>
                    <Button variant="ghost" size="sm" @click="router.push('/main/equipment/list')">
                        设备列表
                        <ArrowUpRight aria-hidden="true" />
                    </Button>
                </template>
                <ResourceTable
                    :fields="[
                        ['equipment', '设备', 220],
                        ['connection', '连接状态', 130],
                        ['runtime', '运行状态', 130],
                        ['updated', '最近上报', 180],
                    ]"
                />
            </ResourceSection>
            <ResourceSection title="近 24 小时告警">
                <template #actions>
                    <Button variant="ghost" size="sm" @click="router.push('/main/equipment/alert')">
                        告警列表
                        <ArrowUpRight aria-hidden="true" />
                    </Button>
                </template>
                <ResourceEmpty text="告警统计未加载" />
            </ResourceSection>
        </div>
        <div class="grid gap-8 @3xl:grid-cols-2">
            <ResourceSection title="关键监测指标"><ResourceEmpty text="遥测数据未加载" /></ResourceSection>
            <ResourceSection title="近期维护"><ResourceEmpty text="维护记录未加载" /></ResourceSection>
        </div>
    </ResourcePage>
</template>
