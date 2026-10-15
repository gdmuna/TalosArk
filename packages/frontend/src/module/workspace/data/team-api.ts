import {
    TeamManagementSchema,
    InvitationDeliverySchema,
    InvitationPreviewSchema,
    InvitationAcceptedSchema,
} from '@talos-ark/contracts/team';
import type { HttpClient } from '@/platform/http';
import type { TeamDataSource, TeamSelection, TeamCommand } from './team-source';

export function createHttpTeamDataSource(http: HttpClient): TeamDataSource {
    const root = (selection: TeamSelection) =>
        `/organization/${encodeURIComponent(selection.organizationId)}/team`;
    function commandRoute(command: TeamCommand): {
        method: 'POST' | 'PATCH' | 'DELETE';
        path: string;
        body?: unknown;
    } {
        switch (command.kind) {
            case 'initialize':
                return { method: 'POST', path: '/initialize' };
            case 'leave':
                return { method: 'POST', path: '/leave' };
            case 'invite':
                return { method: 'POST', path: '/invitation', body: { email: command.email } };
            case 'add-member':
                return { method: 'POST', path: '/member', body: { email: command.email } };
            case 'remove-member':
                return { method: 'DELETE', path: `/member/${command.id}` };
            case 'bind':
                return {
                    method: 'POST',
                    path: `/member/${command.id}/role`,
                    body: { roleIds: command.roleIds },
                };
            case 'create-role':
                return { method: 'POST', path: '/role', body: command.role };
            case 'update-role':
                return { method: 'PATCH', path: `/role/${command.id}`, body: command.role };
            case 'archive-role':
                return { method: 'DELETE', path: `/role/${command.id}` };
            case 'resend':
                return { method: 'POST', path: `/invitation/${command.id}/resend` };
            case 'revoke':
                return { method: 'DELETE', path: `/invitation/${command.id}` };
        }
    }
    return {
        load(selection, query, signal) {
            return http.request({
                method: 'GET',
                path: root(selection),
                params: { ...query, workspaceId: selection.workspaceId },
                schema: TeamManagementSchema,
                signal,
                retry: false,
            });
        },
        async mutate(selection, command, signal) {
            const route = commandRoute(command);
            const request = {
                ...route,
                path: root(selection) + route.path,
                params: ['leave', 'invite', 'add-member', 'remove-member', 'bind'].includes(
                    command.kind
                )
                    ? { workspaceId: selection.workspaceId }
                    : undefined,
                signal,
                retry: false as const,
            };
            if (command.kind === 'invite' || command.kind === 'resend')
                return http.request({ ...request, schema: InvitationDeliverySchema });
            await http.request({ ...request, response: 'empty' });
            return {};
        },
        inspect(token, signal) {
            return http.request({
                method: 'POST',
                path: '/invitation/inspect',
                body: { token },
                schema: InvitationPreviewSchema,
                signal,
                retry: false,
            });
        },
        accept(token, signal) {
            return http.request({
                method: 'POST',
                path: '/invitation/accept',
                body: { token },
                schema: InvitationAcceptedSchema,
                signal,
                retry: false,
            });
        },
    };
}
