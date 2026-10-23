export const INVITATION_DELIVERY = Symbol('INVITATION_DELIVERY');

export interface InvitationMail {
    id: string;
    email: string;
    token: string;
    organizationName: string;
}

export interface InvitationMailDelivery {
    enqueue(item: InvitationMail): boolean;
}
