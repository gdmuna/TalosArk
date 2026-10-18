export type AuditScope = { organizationId: string; workspaceId?: string };

export type AuditQuery = {
    action?: string;
    resourceId?: string;
    from?: string;
    until?: string;
    cursor?: string;
    limit: number;
};

export type AuditRecord = {
    id: string;
    organization: { id: string; name: string };
    workspace: { id: string; name: string } | null;
    actor: { userId: string | null; name: string } | null;
    action: string;
    actionLabel: string;
    occurredAt: string;
    requestId: string | null;
    resources: { resourceId: string; labelSnapshot: string }[];
};

export type AuditEvent = AuditRecord & {
    description: string | null;
    facts: { label: string; value: string }[];
};

export type AuditPage = { items: AuditRecord[]; nextCursor: string | null };

export interface AuditDataSource {
    list(scope: AuditScope, query: AuditQuery, signal: AbortSignal): Promise<AuditPage>;
    event(scope: AuditScope, id: string, signal: AbortSignal): Promise<AuditEvent>;
}
