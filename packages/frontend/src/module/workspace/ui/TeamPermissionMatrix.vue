<script setup lang="ts">
import { Check, Minus } from '@lucide/vue';
import type { TeamManagement, TeamRole } from '@talos-ark/contracts/team';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

defineProps<{ roles: TeamRole[]; definitions: TeamManagement['definitions'] }>();
</script>

<template>
    <div class="max-h-[36rem] min-w-0 overflow-auto scroll-smooth rounded-lg border bg-card motion-reduce:scroll-auto">
        <p v-if="!roles.length" class="p-8 text-center text-sm text-muted-foreground">没有匹配的角色</p>
        <Table v-else container-class="overflow-visible" class="w-max min-w-full table-fixed">
            <caption class="sr-only">角色定义权限矩阵</caption>
            <colgroup>
                <col class="w-64" />
                <col v-for="role in roles" :key="role.id" class="w-44" />
            </colgroup>
            <TableHeader class="sticky top-0 z-20 bg-card">
                <TableRow>
                    <TableHead class="sticky left-0 z-30 bg-card">权限</TableHead>
                    <TableHead v-for="role in roles" :key="role.id" class="whitespace-normal break-words text-center">
                        {{ role.name }}
                        <span class="mt-1 block text-xs font-normal text-muted-foreground">
                            {{ role.scope === 'ORGANIZATION' ? '组织' : '工作区' }}
                        </span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <template v-for="scope in ['ORGANIZATION', 'WORKSPACE'] as const" :key="scope">
                    <TableRow v-if="definitions.some((item) => item.scope === scope)">
                        <TableCell :colspan="roles.length + 1" class="bg-muted/50 font-medium">
                            {{ scope === 'ORGANIZATION' ? '组织权限' : '工作区权限' }}
                        </TableCell>
                    </TableRow>
                    <TableRow
                        v-for="definition in definitions.filter((item) => item.scope === scope)"
                        :key="definition.code"
                    >
                        <TableCell class="sticky left-0 z-10 bg-card whitespace-normal break-words">
                            {{ definition.name }}
                        </TableCell>
                        <TableCell v-for="role in roles" :key="role.id" class="text-center">
                            <template v-if="role.scope === definition.scope">
                                <Check
                                    v-if="role.permissions.includes(definition.code)"
                                    class="mx-auto size-4 text-primary"
                                    aria-hidden="true"
                                />
                                <Minus v-else class="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
                                <span class="sr-only">
                                    {{ role.permissions.includes(definition.code) ? '已授予' : '未授予' }}
                                </span>
                            </template>
                            <span v-else class="text-muted-foreground" aria-label="不适用">—</span>
                        </TableCell>
                    </TableRow>
                </template>
            </TableBody>
        </Table>
    </div>
</template>
