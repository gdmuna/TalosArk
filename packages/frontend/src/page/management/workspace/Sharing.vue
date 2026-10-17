<script setup lang="ts">
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/ui/table';
import { Button } from '@/ui/button';
import { RouterLink } from 'vue-router';
import ManagementSection from '../component/ManagementSection.vue';
import { detailDate, type DetailFacilityAccess } from '../detail/prototype';
const props = defineProps<{
    outgoing: DetailFacilityAccess[];
    incoming: DetailFacilityAccess[];
    workspaces: { id: string; name: string }[];
}>();
</script>
<template>
    <div class="space-y-8">
        <ManagementSection
            v-for="group in [
                { title: '本工作区管理并开放的设施', items: outgoing, outgoing: true },
                { title: '其他工作区开放的设施', items: incoming, outgoing: false },
            ]"
            :key="group.title"
            :title="group.title"
        >
            <div class="overflow-x-auto rounded-md border">
                <Table class="min-w-[680px]" container-class="overflow-visible">
                    <TableHeader>
                        <TableRow>
                            <TableHead>设施</TableHead>
                            <TableHead>{{ group.outgoing ? '访问工作区' : '管理工作区' }}</TableHead>
                            <TableHead>访问级别</TableHead>
                            <TableHead>建立时间</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="item in group.items" :key="`${item.facilityId}:${item.workspaceId}`">
                            <TableCell class="font-medium">{{ item.name }}</TableCell>
                            <TableCell>
                                <Button as-child variant="link" class="h-auto whitespace-normal p-0 text-left">
                                    <RouterLink
                                        :to="`/main/management/workspace/${group.outgoing ? item.workspaceId : item.managementWorkspaceId}?view=sharing`"
                                    >
                                        {{
                                            props.workspaces.find(
                                                (workspace) =>
                                                    workspace.id ===
                                                    (group.outgoing ? item.workspaceId : item.managementWorkspaceId)
                                            )?.name ?? '—'
                                        }}
                                    </RouterLink>
                                </Button>
                            </TableCell>
                            <TableCell>{{ item.level === 'READ' ? '查看设施' : '操作设施' }}</TableCell>
                            <TableCell>{{ detailDate(item.createdAt) }}</TableCell>
                        </TableRow>
                        <TableRow v-if="!group.items.length">
                            <TableCell colspan="4" class="h-28 text-center text-muted-foreground">
                                当前没有设施访问关系
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </ManagementSection>
    </div>
</template>
