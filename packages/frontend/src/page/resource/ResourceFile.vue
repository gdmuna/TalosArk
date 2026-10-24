<script setup lang="ts">
import { Upload, Link } from '@lucide/vue';
import { Button } from '@/ui/button';
import ResourceSection from './ResourceSection.vue';
import ResourceTable from './ResourceTable.vue';
import ResourceEmpty from './ResourceEmpty.vue';
</script>
<template>
    <ResourceSection title="关联文件">
        <template #actions>
            <div class="flex gap-2">
                <Button variant="outline" disabled>
                    <Link aria-hidden="true" />
                    关联文件
                </Button>
                <Button disabled>
                    <Upload aria-hidden="true" />
                    上传文件
                </Button>
            </div>
        </template>
        <ResourceTable
            empty-text="关联文件未加载"
            :fields="[
                ['name', '文件名', 280],
                ['type', '类型', 100],
                ['version', '版本', 100],
                ['size', '大小', 100],
                ['owner', '上传人', 120],
                ['updated', '更新时间', 180],
            ]"
        />
    </ResourceSection>
    <ResourceSection title="文件预览"><ResourceEmpty text="选择文件" /></ResourceSection>
</template>
