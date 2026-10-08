import api from '../client';
import type {
    BoxLogPaginated,
    ReagentLogPaginated,
    CreateFeedbackPayload,
} from '@/schemas/feedback.schema';

export const listBoxLogs = (params: { boxId: string; limit?: number; offset?: number }) =>
    api.get<BoxLogPaginated>('/box/log/list', { params });

export const listReagentLogs = (params: { reagentId: string; limit?: number; offset?: number }) =>
    api.get<ReagentLogPaginated>('/box/log/reagent/list', { params });

export const createFeedback = (data: CreateFeedbackPayload) =>
    api.post<void>('/feedback/add', data);
