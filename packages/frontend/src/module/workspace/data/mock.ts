import type { WorkspaceDataSource } from './source';
import { createWorkspaceFixtures } from './fixture';

export function createMockWorkspaceDataSource(): WorkspaceDataSource {
    const workspace = createWorkspaceFixtures();
    return {
        async load() {
            return structuredClone(workspace);
        },
        async create(name, organizationId) {
            const trimmed = name.trim();
            if (!trimmed || trimmed.length > 40) throw new Error('工作区名称须为 1-40 个字符');
            if (!workspace.organizations.some((item) => item.id === organizationId))
                throw new Error('组织不存在');
            if (
                workspace.workspaces.some(
                    (item) => item.organizationId === organizationId && item.name === trimmed
                )
            )
                throw new Error('该组织中已存在同名工作区');
            const id = crypto.randomUUID();
            workspace.workspaces.push({ id, organizationId, name: trimmed, description: '' });
            return id;
        },
        async join(code) {
            if (code.trim().toUpperCase() !== 'ARK-LAB2026') throw new Error('邀请码无效或已过期');
            if (!workspace.workspaces.some((item) => item.id === 'imaging'))
                workspace.workspaces.push({
                    id: 'imaging',
                    organizationId: 'suzhou',
                    name: '细胞成像平台',
                    description: '显微成像与分析',
                });
            return 'imaging';
        },
    };
}
