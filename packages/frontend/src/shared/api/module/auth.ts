import api from '../client';
import type { UserInfo, LoginForm, RegisterForm } from '@/schemas/user.schema';

/** Shape returned by POST /auth/login and POST /auth/register */
export interface AuthResponse {
    accessToken: string;
    user: { id: string; username: string; email: string };
}

export const login = (data: LoginForm) => api.post<AuthResponse>('/auth/login', data);

export const register = (data: RegisterForm) => api.post<AuthResponse>('/auth/register', data);

export const logout = () => api.get<void>('/auth/clear-cookie');

export const getMyInfo = () => api.get<UserInfo>('/user/info');
