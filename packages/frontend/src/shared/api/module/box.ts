import api from '../client';
import type { BoxAlias, Reagent } from '@/schemas/box.schema';

// Reagents
export const getReagent = (id: string) => api.get<Reagent>('/reagent/one', { params: { id } });

export const listReagents = (nodeId: string) =>
    api.get<Reagent[]>('/reagent/list', { params: { nodeId } });

export const updateReagent = (data: {
    id: string;
    position?: string;
    name?: string;
    description?: string;
}) => api.put<Reagent>('/reagent/update', data);

export const createReagent = (data: {
    nodeId: string;
    position: string;
    name: string;
    description?: string;
    reagentTypeId?: string;
}) => api.post<Reagent>('/reagent/add', data);

// Box Aliases
export const createBoxAlias = (data: { boxId: string; alias: string }) =>
    api.post<BoxAlias>('/box/alias/add', data);

export const deleteBoxAlias = (id: string) => api.delete<void>('/box/alias/del', { id });

export const listBoxAliases = (boxId: string) =>
    api.get<BoxAlias[]>('/box/alias/list', { params: { boxId } });

export const updateBoxAlias = (data: { id: string; alias: string }) =>
    api.put<BoxAlias>('/box/alias/update', data);
