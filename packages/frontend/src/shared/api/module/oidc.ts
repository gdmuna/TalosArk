import {
    OidcLoginCallbackBodySchema,
    OidcLoginCallbackResponseSchema,
    OidcStartResponseSchema,
    type OidcLoginCallbackBody,
    type OidcLoginCallbackResponse,
    type OidcStartResponse,
} from '@talos-ark/contracts/auth';
import api from '../client';

export async function startOidcLogin(): Promise<OidcStartResponse> {
    return OidcStartResponseSchema.parse(await api.post('/auth/oidc/start'));
}

export async function completeOidcLogin(
    body: OidcLoginCallbackBody
): Promise<OidcLoginCallbackResponse> {
    const data = await api.post(
        '/auth/oidc/login-callback',
        OidcLoginCallbackBodySchema.parse(body)
    );
    return OidcLoginCallbackResponseSchema.parse(data);
}
