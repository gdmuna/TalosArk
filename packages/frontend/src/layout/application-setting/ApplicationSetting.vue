<script setup lang="ts">
import { computed, useId } from 'vue';
import { useRouter } from 'vue-router';
import { BookOpen, Box, CircleHelp, ExternalLink, Info, Settings, UserRound, UsersRound } from '@lucide/vue';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { ScrollSurface } from '@/component/scroll-surface';
import { useApplicationSetting, type ApplicationSettingSection } from './context';
import { version, license } from '../../../package.json';

const { open, section, sidebarExpanded, returnFocus } = useApplicationSetting();
const router = useRouter();
const id = useId();
const sections = [
    { id: 'general', label: '通用', icon: Settings },
    { id: 'help', label: '帮助', icon: CircleHelp },
    { id: 'about', label: '关于', icon: Info },
] satisfies { id: ApplicationSettingSection; label: string; icon: unknown }[];
const title = computed(() =>
    section.value === 'general' ? '应用设置' : section.value === 'help' ? '帮助' : '关于璇玑云库'
);
function restoreFocus(event: Event) {
    if (returnFocus.value?.isConnected) {
        event.preventDefault();
        returnFocus.value.focus({ preventScroll: true });
    }
}
async function navigate(path: string) {
    const failure = await router.push(path);
    if (!failure) open.value = false;
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent
            class="flex max-h-[calc(100svh-5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
            @close-auto-focus="restoreFocus"
        >
            <header class="shrink-0 border-b px-6 py-5 pr-12">
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription class="sr-only">应用偏好、帮助与版本信息</DialogDescription>
            </header>
            <div class="flex min-h-0 flex-col sm:flex-row">
                <nav
                    aria-label="应用设置分类"
                    class="flex shrink-0 gap-1 border-b p-3 sm:w-40 sm:flex-col sm:border-b-0 sm:border-r"
                >
                    <Button
                        v-for="item in sections"
                        :key="item.id"
                        variant="ghost"
                        class="justify-start sm:w-full"
                        :class="section === item.id && 'bg-primary-soft text-primary-soft-foreground'"
                        :aria-current="section === item.id ? 'page' : undefined"
                        @click="section = item.id"
                    >
                        <component :is="item.icon" class="size-4" aria-hidden="true" />
                        {{ item.label }}
                    </Button>
                </nav>
                <ScrollSurface edge-effect="line" class="min-h-0 min-w-0 flex-1 sm:min-h-64">
                    <div class="space-y-6 p-6">
                        <template v-if="section === 'general'">
                            <h2 class="font-medium">通用</h2>
                            <Field orientation="horizontal">
                                <Checkbox :id="`${id}-sidebar`" v-model="sidebarExpanded" />
                                <div class="min-w-0 space-y-1">
                                    <FieldLabel :for="`${id}-sidebar`">展开侧栏</FieldLabel>
                                    <FieldDescription>仅保存在此浏览器，不影响其他成员。</FieldDescription>
                                </div>
                            </Field>
                            <dl class="space-y-4 border-t pt-4 text-sm">
                                <div class="flex justify-between gap-4">
                                    <dt class="text-muted-foreground">语言</dt>
                                    <dd>简体中文</dd>
                                </div>
                                <div class="flex justify-between gap-4">
                                    <dt class="text-muted-foreground">外观</dt>
                                    <dd>浅色</dd>
                                </div>
                            </dl>
                        </template>
                        <template v-else-if="section === 'help'">
                            <h2 class="font-medium">帮助资源</h2>
                            <div class="flex flex-col gap-2">
                                <Button
                                    variant="outline"
                                    class="justify-start"
                                    @click="navigate('/main/management/account-setting')"
                                >
                                    <UserRound aria-hidden="true" />
                                    账户设置
                                </Button>
                                <Button
                                    variant="outline"
                                    class="justify-start"
                                    @click="navigate('/main/management/workspace')"
                                >
                                    <UsersRound aria-hidden="true" />
                                    工作区管理
                                </Button>
                                <Button variant="outline" class="justify-start" as-child>
                                    <a
                                        href="https://github.com/gdmuna/TalosArk"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <BookOpen aria-hidden="true" />
                                        项目文档
                                        <ExternalLink class="ml-auto size-3.5" aria-hidden="true" />
                                    </a>
                                </Button>
                            </div>
                        </template>
                        <template v-else>
                            <div class="flex items-center gap-3">
                                <Box class="size-8 text-primary" aria-hidden="true" />
                                <div>
                                    <h2 class="font-semibold">璇玑云库</h2>
                                    <p class="mt-1 text-sm text-muted-foreground">TalosArk</p>
                                </div>
                            </div>
                            <dl class="space-y-4 border-t pt-4 text-sm">
                                <div class="flex justify-between gap-4">
                                    <dt class="text-muted-foreground">版本</dt>
                                    <dd>{{ version }}</dd>
                                </div>
                                <div class="flex justify-between gap-4">
                                    <dt class="text-muted-foreground">许可证</dt>
                                    <dd>{{ license }}</dd>
                                </div>
                            </dl>
                        </template>
                    </div>
                </ScrollSurface>
            </div>
        </DialogContent>
    </Dialog>
</template>
