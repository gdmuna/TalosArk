import type * as Auth from './auth.contract.js';

import { AccessKernel } from '@/core/access/index.js';
import type * as Access from '@/core/access/access.contract.js';
import { IdentityKernel } from '@/core/identity/index.js';
import { IdentityError } from '@/core/identity/identity.error.js';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@/config/index.js';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import {
    AccountProvisionInputSchema,
    type AccountProvisionInput,
    type PasswordLoginBody,
} from '@talos-ark/contracts/auth';
import { AuthError } from './auth.error.js';

@Injectable()
export class AuthService {
    constructor(
        private readonly accessKernel: AccessKernel,
        private readonly identityKernel: IdentityKernel,
        private readonly database: DatabaseRuntime,
        private readonly config: ConfigService<AllConfig, true>
    ) {}

    async provisionAccount(input: AccountProvisionInput, reissueActivation = false) {
        const value = AccountProvisionInputSchema.parse(input);
        const options = this.config.get('auth', { infer: true });
        const command = {
            ...value,
            expiresAt: new Date(Date.now() + options.activationTtlSeconds * 1000),
        };
        const provisioned = reissueActivation
            ? await this.identityKernel.reissueAccountActivation(command)
            : await this.identityKernel.provisionAccount(command);
        const activationUrl = new URL(options.activationUrl);
        activationUrl.hash = new URLSearchParams({ token: provisioned.token }).toString();
        return {
            userId: provisioned.userId,
            activationUrl: activationUrl.href,
            expiresAt: provisioned.expiresAt,
        };
    }

    async passwordLogin(input: PasswordLoginBody): Promise<Access.CreateUserSessionOutput> {
        const verified = await this.identityKernel.authenticateAccount(input);
        return this.database.transaction.run(
            async () => {
                await this.identityKernel.confirmAuthentication(verified);
                return this.accessKernel.createUserSession({ userId: verified.userId });
            },
            { isolationLevel: 'ReadCommitted' }
        );
    }

    async activateAccount(input: { token: string; password: string }): Promise<void> {
        const preparedPassword = await this.identityKernel.preparePassword(input.password);
        await this.database.transaction.run(
            async () => {
                const { userId } = await this.identityKernel.activateAccount({
                    token: input.token,
                    preparedPassword,
                });
                await this.accessKernel.revokeUserSessionAll({ userId });
            },
            { isolationLevel: 'ReadCommitted' }
        );
    }

    async setFirstPassword(input: {
        userId: string;
        sessionId: string;
        password: string;
    }): Promise<Access.CreateUserSessionOutput> {
        const preparedPassword = await this.identityKernel.preparePassword(input.password);
        return this.database.transaction.run(
            async () => {
                await this.identityKernel.lockAccountForCredentialUpdate(input.userId);
                if (
                    !(await this.accessKernel.isFreshUserSession({
                        userId: input.userId,
                        sessionId: input.sessionId,
                        maxAgeSeconds: this.config.get('auth.firstPasswordSessionMaxAgeSeconds', {
                            infer: true,
                        }),
                    }))
                )
                    throw new AuthError({ reason: 'reauthentication-required' });
                await this.identityKernel.setFirstPassword({
                    userId: input.userId,
                    preparedPassword,
                });
                await this.accessKernel.revokeUserSessionAll({ userId: input.userId });
                return this.accessKernel.createUserSession({ userId: input.userId });
            },
            { isolationLevel: 'ReadCommitted', timeout: 10000 }
        );
    }

    async logoutByCookie(refreshToken?: string): Promise<void> {
        if (refreshToken) await this.accessKernel.revokeSessionByRefreshToken({ refreshToken });
    }

    oidcStart() {
        return this.identityKernel.createOidcTransaction();
    }

    sessionRefresh(input: Access.RotateTokenPairInput): Promise<Access.RotateTokenPairOutput> {
        return this.accessKernel.rotateTokenPair(input);
    }

    sessionLogout(input: Access.RevokeUserSessionInput): Promise<Access.RevokeUserSessionOutput> {
        return this.accessKernel.revokeUserSession(input);
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
