import api from '../client';
import type { Reagent, CreateReagentInput, UpdateReagentInput } from '@/schemas/reagent.schema';

// Reagents
export const getReagent = (id: string) => api.get<Reagent>('/reagent/one', { params: { id } });

export const listReagents = (params: { orgId?: string; nodeId?: string }) =>
    api.get<Reagent[]>('/reagent/list', { params });

export const updateReagent = (data: UpdateReagentInput) =>
    api.put<Reagent>('/reagent/update', data);

export const createReagent = (data: CreateReagentInput) => api.post<Reagent>('/reagent/add', data);

export const deleteReagent = (id: string | string[]) => api.delete<void>('/reagent/del', { id });
