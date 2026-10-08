import api from '../client';
import type { UserInfo } from '@/schemas/user.schema';

export const updateUserInfo = (data: { nickname?: string; realname?: string }) =>
    api.put<UserInfo>('/user/update/info', data);

export const updatePassword = (data: { oldPassword: string; newPassword: string }) =>
    api.put<void>('/user/update/password', data);

export const searchUsers = (params: { keyword: string; limit?: number }) =>
    api.get<UserInfo[]>('/user/search', { params });

export interface EmailLoginResponse {
    accessToken: string;
    user: { id: string; username: string; email: string };
}

export const sendEmailCode = (email: string) =>
    api.get<void>('/user/email/code', { params: { email } });

export const emailLogin = (data: { email: string; code: string }) =>
    api.post<EmailLoginResponse>('/user/email/login', data);

export const updateEmail = (data: { email: string; code: string }) =>
    api.put<UserInfo>('/user/update/email', data);

export const emailUpdatePassword = (data: { email: string; code: string; newPassword: string }) =>
    api.put<void>('/user/email/update/password', data);
