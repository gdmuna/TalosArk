import api from '../client';

export interface ShareRecord {
    id: string;
    resourceType: string;
    resourceId: string;
    ownerOrgId: string;
    granteeOrgId: string;
    permission: string;
    status: string;
    createdAt: string;
    ownerOrg?: { id: string; name: string };
    granteeOrg?: { id: string; name: string };
}

export const grantShare = (data: {
    resourceType: string;
    resourceId: string;
    ownerOrgId: string;
    granteeOrgId: string;
    permission: 'READ' | 'WRITE';
}) => api.post<ShareRecord>('/share/grant', data);

export const respondShare = (data: { shareId: string; approve: boolean }) =>
    api.put<ShareRecord>('/share/respond', data);

export const revokeShare = (shareId: string) => api.delete<void>('/share/revoke', { shareId });

export const listOutboundShares = (orgId: string) =>
    api.get<ShareRecord[]>('/share/outbound', { params: { orgId } });

export const listInboundShares = (orgId: string) =>
    api.get<ShareRecord[]>('/share/inbound', { params: { orgId } });
