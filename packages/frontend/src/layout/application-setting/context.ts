import { inject, provide, ref, shallowRef, watch, type InjectionKey } from 'vue';

export type ApplicationSettingSection = 'general' | 'help' | 'about';
const contextKey: InjectionKey<ReturnType<typeof provideApplicationSetting>> =
    Symbol('application-setting');

export function provideApplicationSetting() {
    const open = ref(false);
    const section = ref<ApplicationSettingSection>('general');
    const returnFocus = shallowRef<HTMLElement | null>(null);
    const sidebarExpanded = ref(!document.cookie.split('; ').includes('sidebar_state=false'));
    watch(sidebarExpanded, (value) => {
        document.cookie = `sidebar_state=${value}; path=/; max-age=${60 * 60 * 24 * 7}`;
    });
    const context = {
        open,
        section,
        sidebarExpanded,
        returnFocus,
        show(
            value: ApplicationSettingSection = section.value,
            trigger: HTMLElement | null = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
        ) {
            section.value = value;
            returnFocus.value = trigger;
            open.value = true;
        },
    };
    provide(contextKey, context);
    return context;
}

export function useApplicationSetting() {
    const context = inject(contextKey);
    if (!context) throw new Error('Application settings are not provided');
    return context;
}
