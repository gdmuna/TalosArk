import api from '../client';
import type { BoxImage } from '@/schemas/box.schema';

export const createBoxImage = (data: { boxId: string; imageUrl: string }) =>
    api.post<BoxImage>('/box/image/add', data);

export const listBoxImages = (boxId: string) =>
    api.get<BoxImage[]>('/box/image/list', { params: { boxId } });

export const compareBoxImage = (data: { boxId: string; imageUrl: string }) =>
    api.post('/box/image/compare', data);

export const deleteBoxImage = (id: string) => api.delete<void>('/box/image/del', { id });
