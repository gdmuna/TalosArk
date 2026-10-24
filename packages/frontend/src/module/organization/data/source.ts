export { organizationPolicySchema } from './policy-source';
export type { OrganizationPolicy, OrganizationPolicyDataSource } from './policy-source';

export type OrganizationProfile = {
    id: string;
    name: string;
    ownerUserId: string;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
};

export type OrganizationSummary = {
    organizationId: string;
    activeMemberCount: number | null;
    pendingInvitationCount: number | null;
    measuredAt: string;
};

export interface OrganizationDataSource {
    profile(organizationId: string, signal: AbortSignal): Promise<OrganizationProfile>;
    summary?(organizationId: string, signal: AbortSignal): Promise<OrganizationSummary>;
}
