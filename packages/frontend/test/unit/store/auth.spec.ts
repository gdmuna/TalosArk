import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';

const { mockUser, mockAuthResponse } = vi.hoisted(() => ({
    mockUser: {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        nickname: null,
        realname: null,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    mockAuthResponse: {
        accessToken: 'mock-access-token',
        user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
    },
}));

// Mock @/shared/api/token so setAccessToken/callRefreshToken are controllable
vi.mock('@/shared/api/token', () => ({
    setAccessToken: vi.fn(),
    callRefreshToken: vi.fn().mockResolvedValue('mock-access-token'),
}));

vi.mock('@/shared/api/module/auth', () => ({
    getMyInfo: vi.fn().mockResolvedValue(mockUser),
    login: vi.fn().mockResolvedValue(mockAuthResponse),
    logout: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(mockAuthResponse),
}));

describe('auth store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('isLoggedIn is false initially', () => {
        const auth = useAuthStore();
        expect(auth.isLoggedIn).toBe(false);
    });

    it('initialized is false initially', () => {
        const auth = useAuthStore();
        expect(auth.initialized).toBe(false);
    });

    it('user is null initially', () => {
        const auth = useAuthStore();
        expect(auth.user).toBeNull();
    });

    it('fetchMe sets user on success (refresh token valid)', async () => {
        const auth = useAuthStore();
        await auth.fetchMe();
        expect(auth.user).toEqual(mockUser);
        expect(auth.isLoggedIn).toBe(true);
        expect(auth.initialized).toBe(true);
    });

    it('fetchMe sets user to null when refresh token is missing', async () => {
        const { callRefreshToken } = await import('@/shared/api/token');
        vi.mocked(callRefreshToken).mockResolvedValueOnce(null);

        const auth = useAuthStore();
        await auth.fetchMe();
        expect(auth.user).toBeNull();
        expect(auth.initialized).toBe(true);
        expect(auth.isLoggedIn).toBe(false);
    });

    it('fetchMe sets initialized even when getMyInfo throws', async () => {
        const { getMyInfo } = await import('@/shared/api/module/auth');
        vi.mocked(getMyInfo).mockRejectedValueOnce(new Error('Server error'));

        const auth = useAuthStore();
        await auth.fetchMe();
        expect(auth.user).toBeNull();
        expect(auth.initialized).toBe(true);
    });

    it('doLogin sets user and token', async () => {
        const { setAccessToken } = await import('@/shared/api/token');
        const auth = useAuthStore();
        await auth.doLogin({ account: 'testuser', password: 'password123' });
        expect(setAccessToken).toHaveBeenCalledWith('mock-access-token');
        expect(auth.user).toEqual(mockUser);
        expect(auth.isLoggedIn).toBe(true);
        expect(auth.initialized).toBe(true);
    });

    it('doRegister sets user and token', async () => {
        const { setAccessToken } = await import('@/shared/api/token');
        const auth = useAuthStore();
        await auth.doRegister({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
        });
        expect(setAccessToken).toHaveBeenCalledWith('mock-access-token');
        expect(auth.user).toEqual(mockUser);
        expect(auth.isLoggedIn).toBe(true);
    });

    it('doLogout clears user and token', async () => {
        const { setAccessToken } = await import('@/shared/api/token');
        const auth = useAuthStore();
        auth.user = mockUser;

        await auth.doLogout();
        expect(setAccessToken).toHaveBeenCalledWith(null);
        expect(auth.user).toBeNull();
        expect(auth.isLoggedIn).toBe(false);
    });
});
