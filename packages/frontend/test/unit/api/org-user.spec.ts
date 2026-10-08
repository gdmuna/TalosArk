import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

import api from '@/shared/api/client';
import {
    applyJoinOrg,
    acceptApply,
    rejectApply,
    removeMember,
    inviteUser,
    acceptInvite,
    rejectInvite,
    listPendingOrgUsers,
    listOrgMembers,
    quitOrg,
    updateMemberAuthority,
} from '@/shared/api/module/org-user';

describe('org-user API module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Apply flow ────────────────────────────────────────────────────────

    describe('applyJoinOrg', () => {
        it('calls Post /org/user/apply with orgId', () => {
            applyJoinOrg('org-1');
            expect(api.post).toHaveBeenCalledWith('/org/user/apply', { orgId: 'org-1' });
        });
    });

    describe('acceptApply', () => {
        it('calls Post /org/user/apply/ac with orgId and userId', () => {
            acceptApply({ orgId: 'org-1', userId: 'user-2' });
            expect(api.post).toHaveBeenCalledWith('/org/user/apply/ac', {
                orgId: 'org-1',
                userId: 'user-2',
            });
        });
    });

    describe('rejectApply', () => {
        it('calls Post /org/user/apply/ms with orgId and userId', () => {
            rejectApply({ orgId: 'org-1', userId: 'user-2' });
            expect(api.post).toHaveBeenCalledWith('/org/user/apply/ms', {
                orgId: 'org-1',
                userId: 'user-2',
            });
        });
    });

    // ── Member management ─────────────────────────────────────────────────

    describe('removeMember', () => {
        it('calls Delete /org/user/del with body data', () => {
            removeMember({ orgId: 'org-1', userId: 'user-3' });
            expect(api.delete).toHaveBeenCalledWith('/org/user/del', {
                orgId: 'org-1',
                userId: 'user-3',
            });
        });
    });

    // ── Invite flow ───────────────────────────────────────────────────────

    describe('inviteUser', () => {
        it('calls Post /org/user/invite with orgId and userId', () => {
            inviteUser({ orgId: 'org-1', userId: 'user-5' });
            expect(api.post).toHaveBeenCalledWith('/org/user/invite', {
                orgId: 'org-1',
                userId: 'user-5',
            });
        });
    });

    describe('acceptInvite', () => {
        it('calls Post /org/user/invite/ac with orgId', () => {
            acceptInvite('org-1');
            expect(api.post).toHaveBeenCalledWith('/org/user/invite/ac', {
                orgId: 'org-1',
            });
        });
    });

    describe('rejectInvite', () => {
        it('calls Post /org/user/invite/ms with orgId', () => {
            rejectInvite('org-1');
            expect(api.post).toHaveBeenCalledWith('/org/user/invite/ms', {
                orgId: 'org-1',
            });
        });
    });

    // ── List queries ──────────────────────────────────────────────────────

    describe('listPendingOrgUsers', () => {
        it('calls Get /org/user/list with orgId param', () => {
            listPendingOrgUsers('org-1');
            expect(api.get).toHaveBeenCalledWith('/org/user/list', {
                params: { orgId: 'org-1' },
            });
        });
    });

    describe('listOrgMembers', () => {
        it('calls Get /org/user/member/list with orgId param', () => {
            listOrgMembers('org-1');
            expect(api.get).toHaveBeenCalledWith('/org/user/member/list', {
                params: { orgId: 'org-1' },
            });
        });
    });

    // ── Quit / Authority ──────────────────────────────────────────────────

    describe('quitOrg', () => {
        it('calls Delete /org/user/quit with orgId in body', () => {
            quitOrg('org-1');
            expect(api.delete).toHaveBeenCalledWith('/org/user/quit', { orgId: 'org-1' });
        });
    });

    describe('updateMemberAuthority', () => {
        it('calls Put /org/user/updateAuthority with ADMIN role', () => {
            updateMemberAuthority({ orgId: 'org-1', userId: 'user-2', role: 'ADMIN' });
            expect(api.put).toHaveBeenCalledWith('/org/user/updateAuthority', {
                orgId: 'org-1',
                userId: 'user-2',
                role: 'ADMIN',
            });
        });

        it('calls Put /org/user/updateAuthority with MEMBER role', () => {
            updateMemberAuthority({ orgId: 'org-1', userId: 'user-2', role: 'MEMBER' });
            expect(api.put).toHaveBeenCalledWith('/org/user/updateAuthority', {
                orgId: 'org-1',
                userId: 'user-2',
                role: 'MEMBER',
            });
        });
    });
});
