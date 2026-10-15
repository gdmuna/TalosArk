import type {
    TeamManagement,
    TeamManagementQuery,
    TeamRoleBody,
    TeamRoleUpdate,
} from '@talos-ark/contracts/team';

export interface TeamSelection {
    organizationId: string;
    workspaceId?: string;
}
export type TeamCommand =
    | { kind: 'initialize' | 'leave' }
    | { kind: 'invite' | 'add-member'; email: string }
    | { kind: 'remove-member' | 'archive-role' | 'resend' | 'revoke'; id: string }
    | { kind: 'bind'; id: string; roleIds: string[] }
    | { kind: 'create-role'; role: TeamRoleBody }
    | { kind: 'update-role'; id: string; role: TeamRoleUpdate };

export interface TeamDataSource {
    load(
        selection: TeamSelection,
        query: Omit<TeamManagementQuery, 'workspaceId'>,
        signal: AbortSignal
    ): Promise<TeamManagement>;
    mutate(
        selection: TeamSelection,
        command: TeamCommand,
        signal: AbortSignal
    ): Promise<{ delivery?: 'queued' | 'unavailable' }>;
    inspect(
        token: string,
        signal: AbortSignal
    ): Promise<{
        organizationName: string;
        workspaceName: string | null;
        email: string;
        expiresAt: string;
    }>;
    accept(
        token: string,
        signal: AbortSignal
    ): Promise<{ organizationId: string; workspaceId: string | null }>;
}
