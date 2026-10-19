export interface OrganizationContext {
    readonly userId: string;
    readonly organizationId: string;
    readonly organizationMemberId: string;
    readonly name: string;
    readonly isOwner: boolean;
}

export interface OrganizationAccessContext extends Omit<
    OrganizationContext,
    'organizationMemberId'
> {
    readonly organizationMemberId: string | null;
    readonly isSuperAdmin: boolean;
}
