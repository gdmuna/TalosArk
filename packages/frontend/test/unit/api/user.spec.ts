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
    updateUserInfo,
    updatePassword,
    searchUsers,
    sendEmailCode,
    emailLogin,
    updateEmail,
    emailUpdatePassword,
} from '@/shared/api/module/user';

describe('user API module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('updateUserInfo', () => {
        it('calls Put /user/update/info with nickname', () => {
            const data = { nickname: 'Alex' };
            updateUserInfo(data);
            expect(api.put).toHaveBeenCalledWith('/user/update/info', data);
        });

        it('calls Put /user/update/info with realname', () => {
            const data = { realname: 'Alexander Smith' };
            updateUserInfo(data);
            expect(api.put).toHaveBeenCalledWith('/user/update/info', data);
        });

        it('calls Put /user/update/info with both fields', () => {
            const data = { nickname: 'Alex', realname: 'Alexander Smith' };
            updateUserInfo(data);
            expect(api.put).toHaveBeenCalledWith('/user/update/info', data);
        });

        it('calls Put /user/update/info with empty object', () => {
            updateUserInfo({});
            expect(api.put).toHaveBeenCalledWith('/user/update/info', {});
        });
    });

    describe('updatePassword', () => {
        it('calls Put /user/update/password with old and new password', () => {
            const data = { oldPassword: 'old1234!', newPassword: 'new5678!' };
            updatePassword(data);
            expect(api.put).toHaveBeenCalledWith('/user/update/password', data);
        });
    });

    describe('searchUsers', () => {
        it('calls Get /user/search with keyword', () => {
            const params = { keyword: 'alex' };
            searchUsers(params);
            expect(api.get).toHaveBeenCalledWith('/user/search', { params });
        });

        it('calls Get /user/search with keyword and limit', () => {
            const params = { keyword: 'alex', limit: 10 };
            searchUsers(params);
            expect(api.get).toHaveBeenCalledWith('/user/search', { params });
        });
    });

    describe('email auth and security flows', () => {
        it('calls Get /user/email/code with email param', () => {
            sendEmailCode('a@b.com');
            expect(api.get).toHaveBeenCalledWith('/user/email/code', {
                params: { email: 'a@b.com' },
            });
        });

        it('calls Post /user/email/login with email and code', () => {
            const data = { email: 'a@b.com', code: '123456' };
            emailLogin(data);
            expect(api.post).toHaveBeenCalledWith('/user/email/login', data);
        });

        it('calls Put /user/update/email with email and code', () => {
            const data = { email: 'new@b.com', code: '123456' };
            updateEmail(data);
            expect(api.put).toHaveBeenCalledWith('/user/update/email', data);
        });

        it('calls Put /user/email/update/password with email, code and password', () => {
            const data = { email: 'a@b.com', code: '123456', newPassword: 'password123' };
            emailUpdatePassword(data);
            expect(api.put).toHaveBeenCalledWith('/user/email/update/password', data);
        });
    });
});
