import type { TeamManagementModel } from '../model/team-store';
import type { TeamSelection } from '../data/team-source';

export type TeamManagementContext = {
    team: TeamManagementModel;
    catalog: {
        organizations: { id: string; name: string }[];
        workspaces: { id: string; name: string; organizationId: string }[];
        organization?: { id: string };
        activeId?: string;
    };
    selection: TeamSelection;
    simulation: true;
    roleBindings: Record<string, number>;
    onMemberDetail: (memberId: string) => void;
    onRoleDetail: (roleId: string) => void;
};
