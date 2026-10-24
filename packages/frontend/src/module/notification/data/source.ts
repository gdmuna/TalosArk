export type NotificationChannel = {
    id: string;
    label: string;
    availability: 'available' | 'unavailable' | 'unknown';
    reason: string | null;
};

export type NotificationChannelRule = { channelId: string; enabled: boolean | null };

export type NotificationEventRule = {
    code: string;
    enabled: boolean | null;
    requirement: 'required' | 'optional' | 'unspecified';
    recipients: {
        id: string;
        label: string;
        scope: string | null;
        status: 'active' | 'archived' | 'unknown';
    }[];
    channels: NotificationChannelRule[];
};

export type NotificationDeliveryRule = {
    id: string;
    severity: { label: string; description: string | null };
    timing:
        | { mode: 'immediate' }
        | { mode: 'daily'; time: string; timeZone: string }
        | { mode: 'unspecified' };
    channels: NotificationChannelRule[];
};

export type NotificationPolicySnapshot = {
    organizationId: string;
    scopeLabel: string;
    measuredAt: string;
    updatedAt: string | null;
    updatedBy: string | null;
    channels: NotificationChannel[];
    events: NotificationEventRule[];
    delivery: NotificationDeliveryRule[];
};

export interface NotificationPolicyDataSource {
    read(organizationId: string, signal: AbortSignal): Promise<NotificationPolicySnapshot>;
}
