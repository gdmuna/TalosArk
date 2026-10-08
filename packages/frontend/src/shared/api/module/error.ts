import api from '../client';

export interface ErrorCatalogItem {
    code: string;
    message?: string;
    statusCode?: number;
    [key: string]: unknown;
}

export const listErrors = () => api.get<ErrorCatalogItem[]>('/errors');

export const getErrorByCode = (exceptionCode: string) =>
    api.get<ErrorCatalogItem>(`/errors/${exceptionCode}`);
