import api from '../client';
import type { Org, CreateOrgForm } from '@/schemas/org.schema';

export const createOrg = (data: CreateOrgForm) => api.post<Org>('/org/create', data);

export const deleteOrg = (orgId: string) => api.delete<void>('/org/del', { orgId });

export const getOrg = (orgId: string) => api.get<Org>('/org/one', { params: { orgId } });

export const listOrgs = () => api.get<Org[]>('/org/list');

export const searchOrgs = (params: { keyword: string; limit?: number }) =>
    api.get<Org[]>('/org/search', { params });

export const updateOrg = (data: { orgId: string; name?: string; description?: string }) =>
    api.put<Org>('/org/update', data);

export const updateOrgFull = (data: {
    orgId: string;
    name?: string;
    description?: string;
    isPublic?: boolean;
    avatarUrl?: string;
}) => api.put<Org>('/org/update', data);

export const exploreOrgs = (params?: { keyword?: string; limit?: number; offset?: number }) =>
    api.get<
        {
            id: string;
            name: string;
            description: string;
            avatarUrl: string | null;
            _count: { members: number };
        }[]
    >('/org/explore', { params });

export const searchOrgMembers = (params: { orgId: string; keyword: string }) =>
    api.get<
        { user: { id: string; username: string; nickname: string; email: string }; role: string }[]
    >('/org/members/search', { params });
