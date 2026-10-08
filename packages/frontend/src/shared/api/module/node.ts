import api from '../client';
import { Node } from '@/schemas/node.schema';
import type { NodeImage } from '@/schemas/node.schema';

/** Convenience alias used by stores and pages */
export type NodeItem = Node & { children?: NodeItem[] };

/** 获取单个节点详情 */
export const getNode = (id: string) => api.get<Node>('/node/one', { params: { id } });

/** 获取组织完整节点树（后端返回扁平数组，前端自行构建树） */
export const fetchNodeTree = (orgId: string) =>
    api.get<Node[]>('/node/tree', { params: { orgId } });

/** 创建节点 */
export const createNode = (data: {
    orgId: string;
    name: string;
    parentId?: string;
    description?: string;
    type?: 'ROOT' | 'CONTAINER' | 'BOX' | 'BOX_SLOT';
    metadata?: Record<string, unknown>;
}) => api.post<Node>('/node/add', data);

/** 更新节点 */
export const updateNode = (data: {
    id: string;
    name?: string;
    parentId?: string | null;
    description?: string;
    type?: 'ROOT' | 'CONTAINER' | 'BOX' | 'BOX_SLOT';
    metadata?: Record<string, unknown>;
}) => api.put<Node>('/node/update', data);

/** 删除节点 */
export const deleteNode = (id: string) => api.delete<void>('/node/del', { id });

/** 设置网格配置 */
export const setGridConfig = (data: { nodeId: string; rows: number; cols: number }) =>
    api.post<{ nodeId: string; rows: number; cols: number }>('/node/grid/set', data);

/** 移除网格配置 */
export const removeGridConfig = (nodeId: string) =>
    api.delete<void>('/node/grid/remove', { nodeId });

/** 添加节点图片 */
export const addNodeImage = (data: { nodeId: string; imageUrl: string }) =>
    api.post<NodeImage>('/node/image/add', data);

/** 删除节点图片 */
export const removeNodeImage = (nodeImageId: string) =>
    api.delete<void>('/node/image/remove', { nodeImageId });
