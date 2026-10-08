import {
    OidcLoginCallbackBodySchema,
    type OidcLoginCallbackBody,
    type OidcLoginCallbackResponse,
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

    return {
        startOidcLogin: (options?: RequestOptions) => source.startOidcLogin(options),
        completeOidcLogin,
        clearLocalSession,
    };
}

export type AuthApi = ReturnType<typeof createAuthActions>;
