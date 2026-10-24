export type AccessScope = { organizationId: string; workspaceId?: string };
export type AccessOption = { value: string; label: string };
export type AccessPermission = { code: string; label: string };
export type AccessReference = {
    kind: 'member' | 'role' | 'workspace';
    id: string;
    workspaceId?: string;
};

export type AccessResource = {
    id: string;
    name: string;
    code: string | null;
    type: AccessOption;
    workspace: { id: string; name: string };
    archivedAt: string | null;
    content: { kind: 'material'; id: string } | null;
};

export type ResourceGrant = {
    id: string;
    organizationId: string;
    resource: AccessResource;
    principal: {
        kind: 'member' | 'role' | 'workspace';
        name: string;
        reference: AccessReference | null;
    };
    permissions: AccessPermission[];
    basis: {
        id: string;
        label: string;
        description: string | null;
        reference: AccessReference | null;
    };
    status: 'active' | 'expired' | 'revoked' | 'unavailable';
    grantedAt: string | null;
    expiresAt?: string | null;
    grantedBy: string | null;
    description: string | null;
};

export type ResourceAccessQuery = {
    q?: string;
    type: string[];
    basis: string[];
    status: string[];
    page: number;
    pageSize: number;
};

export type ResourceAccessPage = {
    organizationId: string;
    workspaceId?: string;
    items: ResourceGrant[];
    total: number;
    page: number;
    pageSize: number;
    measuredAt: string;
    filters: { type: AccessOption[]; basis: AccessOption[]; status: AccessOption[] };
};

export type ResourceAccessDetail = {
    organizationId: string;
    resource: AccessResource;
    grants: ResourceGrant[];
    complete: boolean;
    measuredAt: string;
    facts: { label: string; value: string | null }[];
    related:
        { label: string; description: string | null; reference: AccessReference | null }[] | null;
};

export interface ResourceAccessDataSource {
    list(
        scope: AccessScope,
        query: ResourceAccessQuery,
        signal: AbortSignal
    ): Promise<ResourceAccessPage>;
    grant(scope: AccessScope, id: string, signal: AbortSignal): Promise<ResourceGrant>;
    resource(scope: AccessScope, id: string, signal: AbortSignal): Promise<ResourceAccessDetail>;
}

export type SharingPolicySnapshot = {
    organizationId: string;
    scopeLabel: string;
    updatedAt: string;
    updatedBy: string | null;
    rules: {
        resourceType: AccessOption;
        read: string | null;
        operate: string | null;
        request: string | null;
        scope: string | null;
    }[];
    defaults: { validity: string | null; reminder: string | null };
    settings: { label: string; value: string | null }[];
    effect: string | null;
};

export interface SharingPolicyDataSource {
    read(organizationId: string, signal: AbortSignal): Promise<SharingPolicySnapshot>;
}
