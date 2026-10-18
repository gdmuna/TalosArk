export type AuditValue =
    | string
    | number
    | boolean
    | null
    | readonly AuditValue[]
    | { readonly [key: string]: AuditValue };

export interface AuditResourceReference {
    readonly resourceId: string;
    /** The caller supplies the authorized, event-time display name. */
    readonly labelSnapshot: string;
}

export interface AuditRecordInput {
    readonly organizationId: string;
    /** Operation context, not necessarily the owner of every referenced resource. */
    readonly workspaceId?: string;
    readonly actorUserId: string;
    readonly action: string;
    readonly occurredAt: Date;
    readonly requestId?: string;
    /** Explicit business whitelist only; never a request, credential or complete entity. */
    readonly details?: { readonly [key: string]: AuditValue };
    readonly resources?: readonly AuditResourceReference[];
}

/** Provisional until the enclosing business transaction commits. */
export interface AuditReceipt {
    readonly id: string;
    readonly occurredAt: Date;
}

/** A scope declaration is not authorization; the application must authorize it first. */
export type AuditScope =
    | { readonly kind: 'organization'; readonly organizationId: string }
    | {
          readonly kind: 'workspace';
          readonly organizationId: string;
          readonly workspaceId: string;
      };

export interface AuditListInput {
    readonly scope: AuditScope;
    readonly resourceId?: string;
    readonly actions?: readonly string[];
    readonly detailsMatch?: { readonly field: string; readonly value: string };
    /** Inclusive lower and exclusive upper time bounds. */
    readonly from?: Date;
    readonly until?: Date;
    readonly limit?: number;
    readonly cursor?: string;
}

export interface AuditEventSnapshot {
    readonly id: string;
    readonly organizationId: string;
    readonly workspaceId: string | null;
    readonly actorUserId: string | null;
    readonly action: string;
    readonly occurredAt: Date;
    readonly requestId: string | null;
    readonly details: AuditValue;
    readonly resources: readonly AuditResourceReference[];
}

export interface AuditPage {
    readonly items: readonly AuditEventSnapshot[];
    readonly nextCursor: string | null;
}
