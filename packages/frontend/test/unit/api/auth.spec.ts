import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock must be declared before imports that use the module
vi.mock('@/shared/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

import api from '@/shared/api/client';
import { login, register, logout, getMyInfo } from '@/shared/api/module/auth';

describe('auth API module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('login', () => {
        it('calls Post with /auth/login and credentials', () => {
            const data = { account: 'testuser', password: 'password123' };
            login(data);
            expect(api.post).toHaveBeenCalledWith('/auth/login', data);
        });

        it('returns the method object from api', () => {
            const mockMethod = Promise.resolve();
            vi.mocked(api.post).mockReturnValueOnce(mockMethod as any);
            const result = login({ account: 'user', password: 'pass1234' });
            expect(result).toBe(mockMethod);
        });
    });

    describe('register', () => {
        it('calls Post with /auth/register and user data', () => {
            const data = { username: 'newuser', email: 'new@example.com', password: 'password123' };
            register(data);
            expect(api.post).toHaveBeenCalledWith('/auth/register', data);
        });
    });

    describe('logout', () => {
        it('calls Get with /auth/clear-cookie', () => {
            logout();
            expect(api.get).toHaveBeenCalledWith('/auth/clear-cookie');
        });
    });

    describe('getMyInfo', () => {
        it('calls Get with /user/info', () => {
            getMyInfo();
            expect(api.get).toHaveBeenCalledWith('/user/info');
        });
    });
});
