import { z } from 'zod';

const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const identifier = z.string().trim().min(1);
const uniqueId = (items: { id: string }[]) =>
    new Set(items.map((item) => item.id)).size === items.length;
const summary = z.object({
    id: identifier,
    name: z.string().min(1),
    kind: identifier,
    owner: z.enum(['deployment', 'organization']),
    state: z.enum(['connected', 'disconnected', 'unconfigured', 'untested', 'unknown']),
    stateReason: z.string().nullable(),
    checkedAt: timestamp.nullable(),
    lastSynchronizedAt: timestamp.nullable(),
});
export const integrationCatalogSchema = z.object({
    organizationId: identifier,
    measuredAt: timestamp,
    items: z.array(summary).refine(uniqueId),
});
export const integrationDetailSchema = summary.extend({
    organizationId: identifier,
    measuredAt: timestamp,
    description: z.string().nullable(),
    createdAt: timestamp.nullable(),
    createdByLabel: z.string().nullable(),
    configuration: z
        .object({
            availability: z.enum(['available', 'unavailable', 'unknown']),
            reason: z.string().nullable(),
            providerLabel: z.string().nullable(),
            credentialConfigured: z.boolean().nullable(),
            encryptedTransport: z.boolean().nullable(),
        })
        .nullable(),
    events: z
        .array(
            z.object({
                code: identifier,
                label: z.string().min(1),
                description: z.string().nullable(),
                enabled: z.boolean().nullable(),
            })
        )
        .refine((items) => new Set(items.map((item) => item.code)).size === items.length)
        .nullable(),
});
export const integrationLogPageSchema = z.object({
    organizationId: identifier,
    integrationId: identifier,
    kind: z.enum(['activity', 'sync']),
    cursor: identifier.nullable(),
    nextCursor: identifier.nullable(),
    measuredAt: timestamp,
    items: z
        .array(
            z.object({
                id: identifier,
                occurredAt: timestamp,
                eventLabel: z.string().min(1),
                result: z.enum(['succeeded', 'failed', 'pending', 'unknown']),
                summary: z.string().nullable(),
            })
        )
        .refine(uniqueId),
});

export type IntegrationSummary = z.infer<typeof summary>;
export type IntegrationCatalog = z.infer<typeof integrationCatalogSchema>;
export type IntegrationDetail = z.infer<typeof integrationDetailSchema>;
export type IntegrationLogPage = z.infer<typeof integrationLogPageSchema>;
export type IntegrationLogQuery = {
    kind: 'activity' | 'sync';
    cursor: string | null;
    limit: number;
};

export interface IntegrationDataSource {
    list(organizationId: string, signal: AbortSignal): Promise<IntegrationCatalog>;
    detail(
        organizationId: string,
        integrationId: string,
        signal: AbortSignal
    ): Promise<IntegrationDetail>;
    logs(
        organizationId: string,
        integrationId: string,
        query: IntegrationLogQuery,
        signal: AbortSignal
    ): Promise<IntegrationLogPage>;
}
