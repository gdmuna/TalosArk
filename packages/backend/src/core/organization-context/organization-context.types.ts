export interface OrganizationContext {
    readonly userId: string;
    readonly organizationId: string;
    readonly organizationMemberId: string;
    readonly name: string;
    readonly isOwner: boolean;
}
