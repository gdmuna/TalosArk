import {
    OidcLoginCallbackBodySchema,
    type OidcLoginCallbackBody,
    type OidcLoginCallbackResponse,
    PasswordRecoveryRequestBodySchema,
    PasswordRecoveryConfirmBodySchema,
    type PasswordRecoveryRequestBody,
    type PasswordRecoveryConfirmBody,
} from '@talos-ark/contracts/auth';
import { AuthenticationError, type RequestOptions } from '@/platform/http';
import type { AuthDataSource } from '../data/source';
import type { AuthSession } from './session';

export function createAuthActions(source: AuthDataSource, session: AuthSession) {
    let loginRevision = 0;

    async function completeOidcLogin(
        body: OidcLoginCallbackBody,
        options: RequestOptions = {}
    ): Promise<OidcLoginCallbackResponse> {
        const payload = OidcLoginCallbackBodySchema.parse(body);
        const revision = ++loginRevision;
        const response = await source.completeOidcLogin(payload, options);
        // A callback completed after local sign-out must not resurrect the session.
        if (revision !== loginRevision) throw new AuthenticationError('changed');
        if (response.type === 'success') session.accept(response.data);
        return response;
    }

    function clearLocalSession() {
        loginRevision++;
        session.clear();
    }

    async function confirmPasswordRecovery(
        body: PasswordRecoveryConfirmBody,
        options: RequestOptions = {}
    ) {
        const revision = loginRevision;
        const response = await source.confirmPasswordRecovery(
            PasswordRecoveryConfirmBodySchema.parse(body),
            options
        );
        if (revision === loginRevision) clearLocalSession();
        return response;
    }

    return {
        startOidcLogin: (options?: RequestOptions) => source.startOidcLogin(options),
        completeOidcLogin,
        clearLocalSession,
        requestPasswordRecovery: (body: PasswordRecoveryRequestBody, options?: RequestOptions) =>
            source.requestPasswordRecovery(PasswordRecoveryRequestBodySchema.parse(body), options),
        confirmPasswordRecovery,
    };
}

export type AuthApi = ReturnType<typeof createAuthActions>;
