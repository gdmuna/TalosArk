<template>
    <main class="min-w-0 space-y-5 p-4 lg:p-6">
        <header class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div class="min-w-0">
                <h1 class="whitespace-nowrap text-xl font-semibold tracking-tight">欢迎回来</h1>
                <p class="mt-1 text-sm text-muted-foreground">今天是 {{ todayLabel }}。以下是当前工作区的状态摘要。</p>
            </div>
            <Button type="button" variant="outline" class="w-full md:w-auto md:shrink-0">
                <Blocks class="size-4" stroke-width="1.75" aria-hidden="true" />
                自定义布局
            </Button>
        </header>

        <section aria-label="工作概况" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article v-for="item in overviewStats" :key="item.label" class="rounded-lg border bg-card p-4 shadow-xs">
                <div class="flex items-start gap-3">
                    <div :class="['flex size-14 shrink-0 items-center justify-center rounded-lg', item.iconClass]">
                        <component :is="item.icon" class="size-8" stroke-width="1.75" aria-hidden="true" />
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm text-muted-foreground">{{ item.label }}</p>
                        <p class="mt-0.5 text-2xl font-semibold tracking-tight">{{ item.value }}</p>
                        <p class="mt-1 text-xs text-muted-foreground">
                            较昨日
                            <span :class="item.deltaClass">{{ item.delta }}</span>
                        </p>
                    </div>
                </div>
            </article>
        </section>

        <section aria-label="工作区状态" class="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
            <article class="flex h-full flex-col rounded-lg border bg-card p-4 shadow-xs xl:col-span-4">
                <header class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <h2 class="font-semibold">今日待办</h2>
                        <span
                            class="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
                        >
                            {{ todoItems.length }}
                        </span>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-auto px-1 text-xs font-normal text-primary"
                    >
                        查看全部
                        <ArrowRight class="size-3.5" stroke-width="1.75" aria-hidden="true" />
                    </Button>
                </header>
                <ul class="mt-3 divide-y">
                    <li
                        v-for="item in todoItems"
                        :key="item.title"
                        class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                        <div :class="['flex size-7 shrink-0 items-center justify-center rounded-md', item.iconClass]">
                            <component :is="item.icon" class="size-4" stroke-width="1.75" aria-hidden="true" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm">{{ item.title }}</p>
                            <p class="mt-0.5 text-xs text-muted-foreground">{{ item.meta }}</p>
                        </div>
                        <span :class="['shrink-0 rounded px-1.5 py-0.5 text-xs', item.statusClass]">
                            {{ item.status }}
                        </span>
                    </li>
                </ul>
            </article>

            <article class="flex h-full flex-col rounded-lg border bg-card p-4 shadow-xs xl:col-span-4">
                <header>
                    <h2 class="font-semibold">库存预警</h2>
                    <p class="mt-0.5 text-xs text-muted-foreground">需要优先处理的库存风险</p>
                </header>
                <div class="mt-5 space-y-4">
                    <div v-for="item in inventoryAlerts" :key="item.label" class="flex items-center gap-3">
                        <span :class="['size-2 shrink-0 rounded-full', item.indicatorClass]" aria-hidden="true" />
                        <span class="min-w-0 flex-1 text-sm">{{ item.label }}</span>
                        <span class="text-sm font-medium tabular-nums">{{ item.value }}</span>
                    </div>
                </div>
                <div class="mt-auto rounded-md bg-muted p-3 pt-3">
                    <p class="text-xs text-muted-foreground">本周预警趋势</p>
                    <p class="mt-1 text-sm font-medium">较上周增加 2 项</p>
                </div>
            </article>

            <article class="flex h-full flex-col rounded-lg border bg-card p-4 shadow-xs lg:col-span-2 xl:col-span-4">
                <header>
                    <h2 class="font-semibold">设备状态</h2>
                    <p class="mt-0.5 text-xs text-muted-foreground">当前已登记设备的运行情况</p>
                </header>
                <div class="mt-5 space-y-4">
                    <div v-for="item in equipmentStatus" :key="item.label">
                        <div class="flex items-center justify-between gap-3 text-sm">
                            <span class="flex items-center gap-2">
                                <span :class="['size-2 rounded-full', item.indicatorClass]" aria-hidden="true" />
                                {{ item.label }}
                            </span>
                            <span class="font-medium tabular-nums">{{ item.value }}</span>
                        </div>
                        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div :class="['h-full rounded-full', item.indicatorClass, item.widthClass]" />
                        </div>
                    </div>
                </div>
                <p class="mt-auto pt-4 text-xs text-muted-foreground">已登记 48 台设备</p>
            </article>
        </section>

        <section aria-label="工作区快捷入口" class="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
            <article class="flex h-full flex-col rounded-lg border bg-card p-4 shadow-xs xl:col-span-4">
                <header class="flex items-center justify-between gap-3">
                    <div>
                        <h2 class="font-semibold">最近访问</h2>
                        <p class="mt-0.5 text-xs text-muted-foreground">继续处理最近打开的资源</p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-auto px-1 text-xs font-normal text-primary"
                    >
                        全部记录
                        <ArrowRight class="size-3.5" stroke-width="1.75" aria-hidden="true" />
                    </Button>
                </header>
                <ul class="mt-3 divide-y">
                    <li
                        v-for="item in recentItems"
                        :key="item.name"
                        class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                        <div
                            class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground"
                        >
                            <component :is="item.icon" class="size-4" stroke-width="1.75" aria-hidden="true" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm">{{ item.name }}</p>
                            <p class="mt-0.5 text-xs text-muted-foreground">{{ item.meta }}</p>
                        </div>
                        <span class="shrink-0 text-xs text-muted-foreground">{{ item.time }}</span>
                    </li>
                </ul>
                <footer class="mt-auto pt-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-auto px-1 text-xs font-normal text-primary"
                    >
                        查看全部记录
                        <ArrowRight class="size-3.5" stroke-width="1.75" aria-hidden="true" />
                    </Button>
                </footer>
            </article>

            <article class="flex h-full flex-col rounded-lg border bg-card p-4 shadow-xs xl:col-span-4">
                <header>
                    <h2 class="font-semibold">快捷操作</h2>
                    <p class="mt-0.5 text-xs text-muted-foreground">常用工作流的快速入口</p>
                </header>
                <div class="mt-4 grid grid-cols-3 gap-2">
                    <Button
                        v-for="item in quickActions"
                        :key="item.label"
                        type="button"
                        variant="outline"
                        class="h-20 flex-col gap-2 px-2 text-xs font-normal"
                    >
                        <component :is="item.icon" class="size-5 text-primary" stroke-width="1.75" aria-hidden="true" />
                        <span class="truncate">{{ item.label }}</span>
                    </Button>
                </div>
            </article>

            <article class="flex h-full flex-col rounded-lg border bg-card p-4 shadow-xs lg:col-span-2 xl:col-span-4">
                <header class="flex items-center justify-between gap-3">
                    <div>
                        <h2 class="font-semibold">即将到期</h2>
                        <p class="mt-0.5 text-xs text-muted-foreground">需要提前安排的材料与试剂</p>
                    </div>
                    <TriangleAlert class="size-5 text-warning" stroke-width="1.75" aria-hidden="true" />
                </header>
                <ul class="mt-3 divide-y">
                    <li
                        v-for="item in expiringItems"
                        :key="item.name"
                        class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                        <div
                            class="flex size-7 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning-soft-foreground"
                        >
                            <TriangleAlert class="size-4" stroke-width="1.75" aria-hidden="true" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm">{{ item.name }}</p>
                            <p class="mt-0.5 text-xs text-muted-foreground">{{ item.meta }}</p>
                        </div>
                        <span :class="['shrink-0 text-xs font-medium', item.timeClass]">{{ item.time }}</span>
                    </li>
                </ul>
                <footer class="mt-auto pt-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-auto px-1 text-xs font-normal text-primary"
                    >
                        查看全部到期项
                        <ArrowRight class="size-3.5" stroke-width="1.75" aria-hidden="true" />
                    </Button>
                </footer>
            </article>
        </section>
    </main>
</template>

<script setup lang="ts">
import {
    Archive,
    ArrowRight,
    BellRing,
    Blocks,
    Box,
    Boxes,
    ClipboardCheck,
    FlaskConical,
    ListTodo,
    PackageSearch,
    Plus,
    TriangleAlert,
    Wrench,
} from '@lucide/vue';
import { Button } from '@/ui/button';

const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
}).format(new Date());

const overviewStats = [
    {
        label: '低库存预警',
        value: '23',
        delta: '+3',
        icon: TriangleAlert,
        iconClass: 'bg-warning-soft text-warning',
        deltaClass: 'text-destructive',
    },
    {
        label: '活跃培养物',
        value: '48',
        delta: '+5',
        icon: FlaskConical,
        iconClass: 'bg-success-soft text-success',
        deltaClass: 'text-success',
    },
    {
        label: '待审批',
        value: '8',
        delta: '−1',
        icon: ClipboardCheck,
        iconClass: 'bg-primary-soft text-primary',
        deltaClass: 'text-success',
    },
    {
        label: '设备告警',
        value: '5',
        delta: '+2',
        icon: BellRing,
        iconClass: 'bg-destructive-soft text-destructive',
        deltaClass: 'text-destructive',
    },
] as const;

const todoItems = [
    {
        title: '审批细胞系使用申请（张晓明）',
        meta: '09:20',
        status: '审批中',
        icon: ClipboardCheck,
        iconClass: 'bg-primary-soft text-primary-soft-foreground',
        statusClass: 'bg-primary-soft text-primary-soft-foreground',
    },
    {
        title: '领取试剂：胰蛋白酶（Trypsin-EDTA）',
        meta: '10:00',
        status: '待领取',
        icon: FlaskConical,
        iconClass: 'bg-warning-soft text-warning-soft-foreground',
        statusClass: 'bg-warning-soft text-warning-soft-foreground',
    },
    {
        title: '确认超低温冰箱巡检结果',
        meta: '10:30',
        status: '进行中',
        icon: Box,
        iconClass: 'bg-success-soft text-success-soft-foreground',
        statusClass: 'bg-success-soft text-success-soft-foreground',
    },
    {
        title: '审核样品检测任务结果',
        meta: '14:00',
        status: '待审批',
        icon: ListTodo,
        iconClass: 'bg-primary-soft text-primary-soft-foreground',
        statusClass: 'bg-primary-soft text-primary-soft-foreground',
    },
] as const;

const inventoryAlerts = [
    { label: '严重短缺', value: 5, indicatorClass: 'bg-destructive' },
    { label: '库存不足', value: 11, indicatorClass: 'bg-caution' },
    { label: '即将用尽', value: 7, indicatorClass: 'bg-warning' },
] as const;

const equipmentStatus = [
    { label: '运行中', value: 32, indicatorClass: 'bg-success', widthClass: 'w-2/3' },
    { label: '空闲', value: 10, indicatorClass: 'bg-primary', widthClass: 'w-1/5' },
    { label: '维护中', value: 4, indicatorClass: 'bg-muted-foreground/45', widthClass: 'w-[8%]' },
    { label: '故障', value: 2, indicatorClass: 'bg-destructive', widthClass: 'w-[4%]' },
] as const;

const quickActions = [
    { label: '新建材料', icon: Plus },
    { label: '新建设备', icon: Wrench },
    { label: '新建任务', icon: ListTodo },
    { label: '库存查询', icon: PackageSearch },
    { label: '领取申请', icon: ClipboardCheck },
    { label: '库存盘点', icon: Boxes },
] as const;

const recentItems = [
    { name: 'pET-28a 质粒', meta: '材料 · 质粒', time: '今天 09:32', icon: FlaskConical },
    { name: 'DMEM 高糖培养基', meta: '材料 · 培养基', time: '今天 08:45', icon: Box },
    { name: '超低温冰箱 −80°C−02', meta: '设备 · 冰箱', time: '昨天 16:20', icon: Wrench },
    { name: '样品 #S-20250919-001', meta: '样品 · 细胞系', time: '昨天 14:11', icon: Archive },
] as const;

const expiringItems = [
    { name: '胰酶（0.25%）', meta: 'CAS: 9002-07-7', time: '3 天后', timeClass: 'text-destructive' },
    { name: '胎牛血清（FBS）', meta: 'CAS: 16000-44-5', time: '7 天后', timeClass: 'text-warning-foreground' },
    { name: '双抗（青链霉素）', meta: 'CAS: 541-05-6', time: '15 天后', timeClass: 'text-warning-foreground' },
] as const;
</script>
