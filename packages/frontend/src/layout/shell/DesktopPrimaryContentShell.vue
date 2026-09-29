<template>
    <div class="flex flex-col min-h-0 min-w-0 bg-background border-l border-t rounded-tl-2xl">
        <div class="flex h-15 items-center justify-between gap-5 overflow-hidden border-b px-4 py-2 shrink-0">
            <div class="shrink-0 font-medium">
                <span>工作台 / 总览</span>
            </div>
            <div class="flex min-w-0">
                <div class="flex *:size-9">
                    <Button variant="ghost" size="sm" class="p-1" title="通知">
                        <span class="sr-only">通知</span>
                        <Bell aria-hidden="true" class="size-5" stroke-width="1.5" />
                    </Button>
                    <Button variant="ghost" size="sm" class="p-1" title="帮助">
                        <span class="sr-only">帮助</span>
                        <CircleQuestionMark aria-hidden="true" class="size-5" stroke-width="1.5" />
                    </Button>
                    <Button variant="ghost" size="sm" class="p-1" title="设置">
                        <span class="sr-only">设置</span>
                        <Settings aria-hidden="true" class="size-5" stroke-width="1.5" />
                    </Button>
                </div>
                <Popover>
                    <PopoverAnchor class="min-w-0">
                        <PopoverTrigger as-child>
                            <Button
                                variant="ghost"
                                size="sm"
                                class="flex h-full w-full min-w-0 max-w-48 items-center justify-between gap-2.5"
                            >
                                <div class="rounded-full size-6 bg-primary/10 shrink-0"></div>
                                <span class="truncate">Maiturin</span>
                            </Button>
                        </PopoverTrigger>
                    </PopoverAnchor>
                    <PopoverContent class="p-0 w-32" align="end">
                        <div class="flex flex-col items-center p-1">
                            <Button class="font-normal text-sm py-1.5 px-2 h-auto w-full" variant="ghost">
                                <div class="flex items-center justify-between w-full h-full gap-1">
                                    <span>账号设置</span>
                                    <UserRound />
                                </div>
                            </Button>
                            <Button
                                class="hover:bg-destructive/20 font-normal text-sm py-1.5 px-2 h-auto w-full"
                                variant="ghost"
                                @click="$router.push('/auth/login')"
                            >
                                <div class="flex items-center justify-between w-full h-full gap-1">
                                    <span>退出登录</span>
                                    <LogOut />
                                </div>
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
        <RouterTabProvider>
            <slot />
        </RouterTabProvider>
    </div>
</template>

<script setup lang="ts">
import { RouterTabProvider } from '@/modules';

import { Button } from '@/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/ui/popover';

import { Bell, CircleQuestionMark, Settings, LogOut, UserRound } from '@lucide/vue';
</script>

<style scoped></style>
