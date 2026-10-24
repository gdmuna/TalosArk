import type { WorkspaceSnapshot } from '../model/workspace';

export function createWorkspaceFixtures(): WorkspaceSnapshot {
    return {
        organizations: [
            { id: 'sjtu', name: '上海交通大学', canCreateWorkspace: true },
            { id: 'suzhou', name: '苏州研究所', canCreateWorkspace: true },
        ],
        workspaces: [
            {
                id: 'wang',
                organizationId: 'sjtu',
                name: '王教授课题组',
                description: '细胞与分子生物学',
            },
            {
                id: 'li',
                organizationId: 'sjtu',
                name: '李教授课题组',
                description: '药物筛选与分析',
            },
            {
                id: 'platform',
                organizationId: 'sjtu',
                name: '公共平台',
                description: '共享仪器与技术服务',
            },
            {
                id: 'sample',
                organizationId: 'suzhou',
                name: '样本中心',
                description: '生物样本管理',
            },
        ],
        activeId: 'wang',
    };
}
