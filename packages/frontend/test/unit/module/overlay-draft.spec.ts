import { afterEach, describe, expect, it } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useOverlayDraft } from '@/component/overlay-draft/useOverlayDraft';

const wrappers: VueWrapper[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

async function setup() {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: ['/a', '/b'].map((path) => ({ path, component: { render: () => h('div') } })),
    });
    await router.push('/a');
    function form() {
        const open = ref(false),
            input = ref(''),
            busy = ref(false),
            saved = ref(false);
        let draft!: ReturnType<typeof useOverlayDraft>;
        wrappers.push(
            mount(
                defineComponent({
                    setup() {
                        draft = useOverlayDraft(open, () => input.value, { busy, saved });
                        return () => h('div');
                    },
                }),
                { global: { plugins: [router] } }
            )
        );
        return { open, input, busy, saved, draft };
    }
    return { router, form };
}

describe('overlay draft protection', () => {
    it('captures defaults after open initialization, without treating them as edits', async () => {
        const { form } = await setup();
        const f = form();
        f.open.value = true;
        f.input.value = 'initial default';
        await nextTick();
        f.draft.guardedOpen.value = false;
        expect(f.open.value).toBe(false);
        expect(f.draft.confirmOpen.value).toBe(false);
    });

    it('keeps a dirty form open on close/cancel and discards only on confirmation', async () => {
        const { form } = await setup();
        const f = form();
        f.open.value = true;
        await nextTick();
        f.input.value = 'draft';
        f.draft.guardedOpen.value = false;
        expect(f.draft.confirmOpen.value).toBe(true);
        f.draft.confirmOpen.value = false;
        expect(f.open.value).toBe(true);
        expect(f.input.value).toBe('draft');
        f.draft.guardedOpen.value = false;
        f.draft.discard();
        expect(f.open.value).toBe(false);
    });

    it('blocks closing while busy and allows journaled commands to close without draft prompts', async () => {
        const { form } = await setup();
        const f = form();
        f.open.value = true;
        await nextTick();
        f.input.value = 'draft';
        f.busy.value = true;
        f.draft.guardedOpen.value = false;
        expect(f.open.value).toBe(true);
        expect(f.draft.confirmOpen.value).toBe(false);
        f.busy.value = false;
        f.saved.value = true;
        f.draft.guardedOpen.value = false;
        expect(f.open.value).toBe(false);
    });

    it('clears dirty state when a deliberate reload establishes a new baseline', async () => {
        const { form } = await setup();
        const f = form();
        f.open.value = true;
        await nextTick();
        f.input.value = 'reloaded';
        f.draft.markClean();
        f.draft.guardedOpen.value = false;
        expect(f.open.value).toBe(false);
    });

    it('warns before unloading only for an unsent draft and removes the listener on disposal', async () => {
        const { form } = await setup();
        const f = form();
        f.open.value = true;
        await nextTick();
        f.input.value = 'draft';
        const unload = () => window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
        expect(unload()).toBe(false);
        f.saved.value = true;
        expect(unload()).toBe(true);
        f.saved.value = false;
        wrappers.pop()?.unmount();
        expect(unload()).toBe(true);
    });

    it('supports canceling navigation, then leaving without replaying a command', async () => {
        const { router, form } = await setup();
        const f = form();
        f.open.value = true;
        await nextTick();
        f.input.value = 'draft';
        const cancel = router.push('/b');
        await flushPromises();
        expect(f.draft.confirmOpen.value).toBe(true);
        f.draft.confirmOpen.value = false;
        await cancel;
        expect(router.currentRoute.value.path).toBe('/a');
        expect(f.open.value).toBe(true);
        const leave = router.push('/b');
        await flushPromises();
        f.draft.discard();
        await leave;
        expect(router.currentRoute.value.path).toBe('/b');
        expect(f.open.value).toBe(false);
    });

    it('does not discard the first draft if a second nested draft cancels navigation', async () => {
        const { router, form } = await setup();
        const first = form(),
            second = form();
        first.open.value = second.open.value = true;
        await nextTick();
        first.input.value = 'first';
        second.input.value = 'second';
        const leave = router.push('/b');
        await flushPromises();
        first.draft.discard();
        await flushPromises();
        expect(second.draft.confirmOpen.value).toBe(true);
        second.draft.confirmOpen.value = false;
        await leave;
        expect(first.open.value).toBe(true);
        expect(second.open.value).toBe(true);
        expect(router.currentRoute.value.path).toBe('/a');
    });
});
