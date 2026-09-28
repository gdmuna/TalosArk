import type { ApiResponse } from '@talos-ark/contracts/protocol';

/**
 * In-memory access token store.
 *
 * The access token is intentionally NOT persisted to localStorage/sessionStorage
 * because it is short-lived. On a fresh page load, `callRefreshToken()` exchanges
 * the HttpOnly refresh-token cookie for a new access token.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

let _accessToken: string | null = null;

export const getAccessToken = () => _accessToken;
export const setAccessToken = (token: string | null) => {
    _accessToken = token;
};

/**
 * Calls POST /auth/refresh-token using the HttpOnly refresh cookie.
 * Uses raw fetch (not the alova instance) to avoid triggering the 401 refresh loop.
 *
 * @returns New access token on success, or null if refresh cookie is missing/expired.
 */
export async function callRefreshToken(): Promise<string | null> {
    try {
        const resp = await fetch(`${BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!resp.ok) return null;
        const json: ApiResponse<{ accessToken: string }> = await resp.json();
        if (!json.success || !json.data?.accessToken) return null;
        return json.data.accessToken;
    } catch {
        return null;
    }
}
