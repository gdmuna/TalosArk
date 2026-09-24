import axios from 'axios';
import { getAccessToken, setAccessToken, callRefreshToken } from './token';

interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data: T;
}

export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    withCredentials: true,
});

// Request interceptor: attach Bearer token
axiosInstance.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor: unwrap envelope + handle 401 refresh
axiosInstance.interceptors.response.use(
    (response): any => {
        const json: ApiResponse = response.data;
        if (!json.success) {
            throw new Error(json.message || 'API Error');
        }
        return json.data;
    },
    async (error) => {
        if (error.response?.status === 401) {
            const newToken = await callRefreshToken();
            if (newToken) {
                setAccessToken(newToken);
            } else {
                setAccessToken(null);
            }
            throw new Error('Unauthorized');
        }
        throw error;
    }
);

/**
 * Thin wrapper around the axios instance that provides the same call signature
 * as the previous alova-based client, so API module files need minimal changes.
 */
export const api = {
    get: <T = unknown>(url: string, config?: Record<string, unknown>) =>
        axiosInstance.get<any, T>(url, config),
    post: <T = unknown>(url: string, data?: unknown) => axiosInstance.post<any, T>(url, data),
    put: <T = unknown>(url: string, data?: unknown) => axiosInstance.put<any, T>(url, data),
    /** `data` is sent as the request body (`{ data }` in axios DELETE config). */
    delete: <T = unknown>(url: string, data?: unknown) =>
        axiosInstance.delete<any, T>(url, { data }),
};

export default api;
