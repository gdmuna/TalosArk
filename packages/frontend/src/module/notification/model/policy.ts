import {
    computed,
    inject,
    onScopeDispose,
    ref,
    shallowRef,
    watch,
    type InjectionKey,
    type Ref,
} from 'vue';
import { AuthenticationError, HttpError } from '@/platform/http';
import type { NotificationPolicyDataSource, NotificationPolicySnapshot } from '../data/source';

export const notificationPolicyDataSourceKey: InjectionKey<NotificationPolicyDataSource> =
    Symbol('notificationPolicy');

export function assertNotificationPolicy(
    organizationId: string,
    snapshot: NotificationPolicySnapshot
) {
    const unique = (values: string[]) =>
        values.every((value) => !!value) && new Set(values).size === values.length;
    const channelIds = new Set(snapshot.channels.map((channel) => channel.id));
    const rules = [...snapshot.events, ...snapshot.delivery];
    if (
        snapshot.organizationId !== organizationId ||
        !Number.isFinite(Date.parse(snapshot.measuredAt)) ||
        (snapshot.updatedAt !== null && !Number.isFinite(Date.parse(snapshot.updatedAt))) ||
        !unique(snapshot.channels.map((channel) => channel.id)) ||
        !unique(snapshot.events.map((event) => event.code)) ||
        !unique(snapshot.delivery.map((rule) => rule.id)) ||
        snapshot.channels.some(
            (channel) => !['available', 'unavailable', 'unknown'].includes(channel.availability)
        ) ||
        snapshot.events.some(
            (event) =>
                ![true, false, null].includes(event.enabled) ||
                !['required', 'optional', 'unspecified'].includes(event.requirement) ||
                !unique(event.recipients.map((recipient) => recipient.id)) ||
                event.recipients.some(
                    (recipient) => !['active', 'archived', 'unknown'].includes(recipient.status)
                )
        ) ||
        rules.some(
            (rule) =>
                !unique(rule.channels.map((channel) => channel.channelId)) ||
                rule.channels.some(
                    (channel) =>
                        !channelIds.has(channel.channelId) ||
                        ![true, false, null].includes(channel.enabled)
                )
        ) ||
        snapshot.delivery.some((rule) => {
            if (rule.timing.mode === 'immediate' || rule.timing.mode === 'unspecified')
                return false;
            if (rule.timing.mode !== 'daily' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.timing.time))
                return true;
            try {
                new Intl.DateTimeFormat('zh-CN', { timeZone: rule.timing.timeZone });
                return !rule.timing.timeZone;
            } catch {
                return true;
            }
        })
    )
        throw new HttpError('通知策略响应无效', 'protocol');
}

export function useNotificationPolicy(
    context: Ref<{ accountId: string; organizationId: string } | null>
) {
    const source = inject(notificationPolicyDataSourceKey, null);
    const data = shallowRef<NotificationPolicySnapshot>();
    const loading = ref(false);
    const error = ref('');
    const key = computed(() => (context.value ? JSON.stringify(context.value) : ''));
    let request: AbortController | undefined;

    async function refresh() {
        request?.abort();
        const selected = context.value;
        const current = new AbortController();
        request = current;
        loading.value = !!source && !!selected;
        error.value = '';
        if (!source || !selected) {
            data.value = undefined;
            return;
        }
        try {
            const result = await source.read(selected.organizationId, current.signal);
            if (current.signal.aborted) return;
            try {
                assertNotificationPolicy(selected.organizationId, result);
            } catch {
                throw new HttpError('通知策略响应无效', 'protocol');
            }
            data.value = result;
        } catch (cause) {
            if (current.signal.aborted) return;
            const status = cause instanceof HttpError ? cause.status : undefined;
            const authentication = cause instanceof AuthenticationError || status === 401;
            const protocol = cause instanceof HttpError && cause.kind === 'protocol';
            if (authentication || protocol || status === 403 || status === 404)
                data.value = undefined;
            error.value = authentication
                ? '登录会话已改变，请重新加载'
                : status === 403
                  ? '当前账户无权查看此组织的通知策略'
                  : status === 404
                    ? '通知策略不存在或已不可访问'
                    : protocol
                      ? ''
                      : '通知策略读取失败，请重试';
        } finally {
            if (!current.signal.aborted) loading.value = false;
        }
    }
    watch(
        key,
        () => {
            data.value = undefined;
            void refresh();
        },
        { immediate: true, flush: 'sync' }
    );
    onScopeDispose(() => request?.abort());
    return { available: !!source, data, loading, error, refresh };
}
