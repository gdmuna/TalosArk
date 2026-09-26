import type * as Auth from './auth.contract.js';

import { AccessKernel } from '@/core/access/index.js';
import { IdentityKernel } from '@/core/identity/index.js';

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

    async oidcLoginCallback(input: Auth.OidcLoginCallbackInput) {
        const oidcRes = await this.identityKernel.resolveOidcLoginCallback(input);

        let user = await this.identityKernel.getInternalUser({
            type: 'externalIdentity',
            verifiedIdToken: oidcRes.verifiedIdToken,
        });

        if (user) {
            return {
                type: 'success',
                data: {
                    ...(await this.accessKernel.createUserSession({ userId: user.id })),
                },
            };
        }

        const casdoorUser = oidcRes.verifiedIdToken.claims;

        if (!casdoorUser.email) {
            return {
                type: 'block',
                data: {},
            };
        }

        user = await this.identityKernel.createInternalUser({
            username: casdoorUser.name,
            email: casdoorUser.email,
            profile: {
                create: {
                    nickname: casdoorUser.displayName,
                },
            },
            externalIdentities: {
                create: {
                    issuer: oidcRes.verifiedIdToken.issuer,
                    subject: oidcRes.verifiedIdToken.subject,
                },
            },
        });

        return {
            type: 'success',
            data: {
                ...(await this.accessKernel.createUserSession({ userId: user.id })),
            },
        };
    }
}
