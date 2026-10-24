import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IdentityCredential } from '../../../../src/core/identity/internal/identity.credential.js';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import { SeedSecrets } from '../../runtime/secret.js';
import { credentialKind } from './credential.kind.js';
import { seedHash } from '../../definition/value.js';
import { type BusinessSeeder } from '../../runtime/handler.js';
import type { SeedExecution } from '../../runtime/execution.js';

@Injectable()
export class CredentialSeeder implements BusinessSeeder<typeof credentialKind> {
    constructor(
        private readonly identity: IdentityCredential,
        private readonly database: DatabaseRuntime,
        private readonly secrets: SeedSecrets
    ) {}
    async seed(
        data: z.output<typeof credentialKind.data>,
        accounts: z.output<typeof credentialKind.input>,
        execution: SeedExecution
    ) {
        const account = accounts[data.account];
        if (!account?.active)
            throw new Error('Credential fixtures require a newly activated account');
        const snapshot = async (id: string) => {
            const user = await this.database.queryClient.user.findUniqueOrThrow({
                where: { id },
                select: { id: true, username: true, email: true, passwordHash: true },
            });
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                passwordFingerprint: seedHash(user.passwordHash),
            };
        };
        await execution.record({
            key: 'authenticate',
            output: z.uuid(),
            create: async () =>
                (
                    await this.identity.authenticate({
                        identifier: account.username,
                        password: this.secrets.accountPassword(account.userId),
                    })
                ).userId,
            inspect: snapshot,
        });
        const revokedRecoveryId = await execution.record({
            key: 'recovery-revoked',
            output: z.uuid(),
            create: async () => {
                const recovery = await this.identity.issuePasswordRecovery({
                    email: account.email,
                    expiresAt: new Date(Date.now() + 3600000),
                });
                if (!recovery) throw new Error('Seed account was not eligible for recovery');
                await this.identity.revokePasswordRecovery(recovery.id);
                return recovery.id;
            },
            inspect: (id) =>
                this.database.queryClient.passwordResetToken.findUniqueOrThrow({
                    where: { id },
                    select: {
                        id: true,
                        userId: true,
                        consumedAt: true,
                        revokedAt: true,
                        expiresAt: true,
                    },
                }),
        });
        const password = execution.mode === 'apply' ? this.secrets.password() : undefined;
        const preparedPassword = password
            ? await this.identity.preparePassword(password)
            : undefined;
        let changed = false;
        const consumedRecoveryId = await execution.record({
            key: 'recovery-consumed',
            output: z.uuid(),
            create: async () => {
                if (!preparedPassword || !password)
                    throw new Error('Missing prepared seed password');
                const recovery = await this.identity.issuePasswordRecovery({
                    email: account.email,
                    expiresAt: new Date(Date.now() + 3600000),
                });
                if (!recovery) throw new Error('Seed account was not eligible for recovery');
                await this.identity.confirmPasswordRecovery({
                    token: recovery.token,
                    preparedPassword,
                });
                await this.identity.authenticate({ identifier: account.email, password });
                changed = true;
                return recovery.id;
            },
            inspect: async (id) => ({
                user: await snapshot(account.userId),
                recovery: await this.database.queryClient.passwordResetToken.findUniqueOrThrow({
                    where: { id },
                    select: {
                        id: true,
                        userId: true,
                        consumedAt: true,
                        revokedAt: true,
                        expiresAt: true,
                    },
                }),
            }),
        });
        if (changed && password) this.secrets.replacePassword(account.userId, password);
        return { userId: account.userId, revokedRecoveryId, consumedRecoveryId };
    }
}
