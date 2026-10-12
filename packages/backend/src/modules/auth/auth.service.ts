import type * as Auth from './auth.contract.js';

import { AccessKernel } from '@/core/access/index.js';
import type * as Access from '@/core/access/access.contract.js';
import { IdentityKernel } from '@/core/identity/index.js';
import { IdentityError } from '@/core/identity/identity.error.js';

import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
    constructor(
        private readonly accessKernel: AccessKernel,
        private readonly identityKernel: IdentityKernel
    ) {}

    oidcStart() {
        return this.identityKernel.createOidcTransaction();
    }

    sessionRefresh(input: Access.RotateTokenPairInput): Promise<Access.RotateTokenPairOutput> {
        return this.accessKernel.rotateTokenPair(input);
    }

    async sessionLogout(input: Access.RevokeUserSessionInput): Promise<void> {
        await this.accessKernel.revokeUserSession(input);
    }

    async oidcLoginCallback(
        input: Auth.OidcLoginCallbackInput
    ): Promise<Auth.OidcLoginCallbackOutput> {
        const oidcRes = await this.identityKernel.resolveOidcLoginCallback(input);

        let user = await this.identityKernel.getInternalUser({
            type: 'externalIdentity',
            externalIdentity: oidcRes.externalIdentity,
        });

        if (user) {
            return {
                type: 'success',
                data: {
                    ...(await this.accessKernel.createUserSession({ userId: user.id })),
                },
            };
        }

        const { registration } = oidcRes;

        if (!registration.email) {
            return {
                type: 'block',
                data: {},
            };
        }

        if (registration.username === undefined) {
            throw new IdentityError({ reason: 'provider-response-invalid' });
        }

        user = await this.identityKernel.createInternalUser({
            username: registration.username,
            email: registration.email,
            profile: {
                nickname: registration.nickname,
            },
            externalIdentities: [oidcRes.externalIdentity],
        });

        return {
            type: 'success',
            data: {
                ...(await this.accessKernel.createUserSession({ userId: user.id })),
            },
        };
    }
}
