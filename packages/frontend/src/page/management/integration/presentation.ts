import { HardDrive, KeyRound, Network, Webhook, Plug } from '@lucide/vue';
import type { IntegrationSummary } from '@/module/integration';
import type { StateTone } from '@/component/state-badge';
import { formatDateTime } from '@/shared/util/date-time';

export function integrationIcon(kind: string) {
    switch (kind) {
        case 'storage':
            return HardDrive;
        case 'identity':
            return KeyRound;
        case 'gateway':
            return Network;
        case 'webhook':
            return Webhook;
        default:
            return Plug;
    }
}
export const integrationState: Record<
    IntegrationSummary['state'],
    { label: string; tone: StateTone }
> = {
    connected: { label: '已连接', tone: 'success' },
    disconnected: { label: '连接异常', tone: 'destructive' },
    unconfigured: { label: '未配置', tone: 'warning' },
    untested: { label: '未探测', tone: 'neutral' },
    unknown: { label: '状态未知', tone: 'neutral' },
};
export const integrationOwner = { deployment: '部署级', organization: '组织级' };
export const integrationTime = (value: string | null) =>
    value ? formatDateTime(Date.parse(value)) : '未提供';
