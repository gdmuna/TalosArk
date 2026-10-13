import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { IdentityError } from '../identity.error.js';
import { identityErrors } from '../identity.error.mapper.js';
import { IdentityPasswordHasher } from './password.hasher.js';
import { assertNewPassword } from './password.policy.js';
import type * as Identity from '../identity.contract.js';

const tokenHash = (value: string) => createHash('sha256').update(value).digest('base64url');

@Injectable()
export class IdentityCredential {
    private readonly preparedPasswords = new WeakMap<Identity.PreparedPassword, string>();

    constructor(
        private readonly database: DatabaseRuntime,
        private readonly password: IdentityPasswordHasher
    ) {}

    async preparePassword(password: string): Promise<Identity.PreparedPassword> {
        assertNewPassword(password);
        const hash = await this.password.hash(password);
        const prepared = Object.freeze({}) as Identity.PreparedPassword;
        this.preparedPasswords.set(prepared, hash);
        return prepared;
    }

    provision(input: Identity.ProvisionAccountInput): Promise<Identity.ProvisionAccountOutput> {
        return identityErrors.run(async () => {
            const token = randomBytes(32).toString('base64url');
            const user = await this.database.queryClient.user.create({
                data: {
                    username: input.username.trim(),
                    email: input.email.trim().toLowerCase(),
                    activationTokens: {
                        create: {
                            tokenHash: tokenHash(token),
                            email: input.email.trim().toLowerCase(),
                            expiresAt: input.expiresAt,
                        },
                    },
                },
                select: { id: true },
            });
            return { userId: user.id, token, expiresAt: input.expiresAt };
        });
    }

    async authenticate(
        input: Identity.AuthenticateAccountInput
    ): Promise<Identity.AuthenticatedAccount> {
        return identityErrors.run(async () => {
            const identifier = input.identifier.trim();
            const users = await this.database.queryClient.user.findMany({
                where: {
                    OR: [
                        { username: identifier },
                        { email: { equals: identifier, mode: 'insensitive' } },
                    ],
                },
                select: { id: true, passwordHash: true },
                take: 2,
            });
            const user = users.length === 1 ? users[0] : undefined;
            if (
                !(await this.password.verify(input.password, user?.passwordHash ?? null)) ||
                !user?.passwordHash
            ) {
                throw new IdentityError({ reason: 'credentials-invalid' });
            }
            return { userId: user.id, credentialVersion: tokenHash(user.passwordHash) };
        });
    }

    reissueActivation(
        input: Identity.ProvisionAccountInput
    ): Promise<Identity.ProvisionAccountOutput> {
        return identityErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    const found = await this.database.queryClient.user.findFirst({
                        where: {
                            username: input.username.trim(),
                            email: { equals: input.email.trim(), mode: 'insensitive' },
                        },
                        select: { id: true },
                    });
                    if (!found) throw new IdentityError({ reason: 'activation-invalid' });
                    await this.lockUser(found.id);
                    const user = await this.database.queryClient.user.findUnique({
                        where: { id: found.id },
                        select: {
                            email: true,
                            passwordHash: true,
                            activationTokens: { take: 1, select: { id: true } },
                        },
                    });
                    if (
                        !user ||
                        user.passwordHash !== null ||
                        user.activationTokens.length === 0 ||
                        user.email.trim().toLowerCase() !== input.email.trim().toLowerCase()
                    )
                        throw new IdentityError({ reason: 'activation-invalid' });
                    const token = randomBytes(32).toString('base64url');
                    await this.database.queryClient.userActivationToken.updateMany({
                        where: { userId: found.id, consumedAt: null, revokedAt: null },
                        data: { revokedAt: new Date() },
                    });
                    await this.database.queryClient.userActivationToken.create({
                        data: {
                            userId: found.id,
                            email: user.email.trim().toLowerCase(),
                            tokenHash: tokenHash(token),
                            expiresAt: input.expiresAt,
                        },
                    });
                    return { userId: found.id, token, expiresAt: input.expiresAt };
                },
                { isolationLevel: 'ReadCommitted' }
            )
        );
    }

    lockForCredentialUpdate(userId: string): Promise<void> {
        return identityErrors.run(() =>
            this.database.transaction.run(() => this.lockUser(userId), { propagation: 'mandatory' })
        );
    }

    /** Recheck under the same user lock used by credential writers before issuing a session. */
    async confirmAuthentication(input: Identity.AuthenticatedAccount): Promise<void> {
        return identityErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    await this.lockUser(input.userId);
                    const user = await this.database.queryClient.user.findUnique({
                        where: { id: input.userId },
                        select: { passwordHash: true },
                    });
                    if (
                        !user?.passwordHash ||
                        tokenHash(user.passwordHash) !== input.credentialVersion
                    )
                        throw new IdentityError({ reason: 'credentials-invalid' });
                },
                { propagation: 'mandatory' }
            )
        );
    }

    async activate(input: Identity.ActivateAccountInput): Promise<Identity.ActivateAccountOutput> {
        const hash = this.readPreparedPassword(input.preparedPassword);
        return identityErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    const activation =
                        await this.database.queryClient.userActivationToken.findUnique({
                            where: { tokenHash: tokenHash(input.token) },
                            select: { id: true, userId: true },
                        });
                    if (!activation) throw new IdentityError({ reason: 'activation-invalid' });
                    await this.lockUser(activation.userId);
                    const current = await this.database.queryClient.userActivationToken.findUnique({
                        where: { id: activation.id },
                        select: {
                            consumedAt: true,
                            revokedAt: true,
                            expiresAt: true,
                            email: true,
                            user: { select: { email: true, passwordHash: true } },
                        },
                    });
                    const now = new Date();
                    if (
                        !current ||
                        current.consumedAt ||
                        current.revokedAt ||
                        current.expiresAt <= now ||
                        current.user.passwordHash !== null ||
                        current.email !== current.user.email.trim().toLowerCase()
                    ) {
                        throw new IdentityError({ reason: 'activation-invalid' });
                    }
                    await this.database.queryClient.userActivationToken.update({
                        where: { id: activation.id },
                        data: { consumedAt: now },
                    });
                    await this.writeFirstPassword(activation.userId, hash, now);
                    return { userId: activation.userId };
                },
                { isolationLevel: 'ReadCommitted', propagation: 'mandatory' }
            )
        );
    }

    async setFirstPassword(input: Identity.SetFirstPasswordInput): Promise<void> {
        const hash = this.readPreparedPassword(input.preparedPassword);
        return identityErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    await this.lockUser(input.userId);
                    // This route is for a bound external identity, not unfinished operator-created accounts.
                    const user = await this.database.queryClient.user.findUnique({
                        where: { id: input.userId },
                        select: {
                            passwordHash: true,
                            externalIdentities: { take: 1, select: { id: true } },
                        },
                    });
                    if (!user || user.externalIdentities.length === 0)
                        throw new IdentityError({ reason: 'credentials-invalid' });
                    if (user.passwordHash !== null)
                        throw new IdentityError({ reason: 'password-present' });
                    await this.writeFirstPassword(input.userId, hash, new Date());
                },
                { isolationLevel: 'ReadCommitted', propagation: 'mandatory' }
            )
        );
    }

    issuePasswordRecovery(
        input: Identity.IssuePasswordRecoveryInput
    ): Promise<Identity.IssuedPasswordRecovery | null> {
        return identityErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    const email = input.email.trim().toLowerCase();
                    const matches = await this.database.queryClient.user.findMany({
                        where: { email: { equals: email, mode: 'insensitive' } },
                        select: { id: true },
                        take: 2,
                    });
                    if (matches.length !== 1) return null;
                    const userId = matches[0].id;
                    await this.lockUser(userId);
                    const user = await this.database.queryClient.user.findUnique({
                        where: { id: userId },
                        select: { email: true, passwordHash: true },
                    });
                    if (!user?.passwordHash || user.email.trim().toLowerCase() !== email)
                        return null;
                    const token = randomBytes(32).toString('base64url');
                    await this.database.queryClient.passwordResetToken.updateMany({
                        where: { userId, consumedAt: null, revokedAt: null },
                        data: { revokedAt: new Date() },
                    });
                    const reset = await this.database.queryClient.passwordResetToken.create({
                        data: {
                            userId,
                            email,
                            tokenHash: tokenHash(token),
                            expiresAt: input.expiresAt,
                        },
                        select: { id: true },
                    });
                    return { id: reset.id, email, token, expiresAt: input.expiresAt };
                },
                { isolationLevel: 'ReadCommitted' }
            )
        );
    }

    revokePasswordRecovery(id: string): Promise<void> {
        return identityErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    const reset = await this.database.queryClient.passwordResetToken.findUnique({
                        where: { id },
                        select: { userId: true },
                    });
                    if (!reset) return;
                    await this.lockUser(reset.userId);
                    await this.database.queryClient.passwordResetToken.updateMany({
                        where: { id, consumedAt: null, revokedAt: null },
                        data: { revokedAt: new Date() },
                    });
                },
                { isolationLevel: 'ReadCommitted' }
            )
        );
    }

    confirmPasswordRecovery(
        input: Identity.ConfirmPasswordRecoveryInput
    ): Promise<Identity.ConfirmPasswordRecoveryOutput> {
        const hash = this.readPreparedPassword(input.preparedPassword);
        return identityErrors.run(() =>
            this.database.transaction.run(
                async () => {
                    const reset = await this.database.queryClient.passwordResetToken.findUnique({
                        where: { tokenHash: tokenHash(input.token) },
                        select: { id: true, userId: true },
                    });
                    if (!reset) throw new IdentityError({ reason: 'password-recovery-invalid' });
                    await this.lockUser(reset.userId);
                    const current = await this.database.queryClient.passwordResetToken.findUnique({
                        where: { id: reset.id },
                        select: {
                            consumedAt: true,
                            revokedAt: true,
                            expiresAt: true,
                            email: true,
                            user: { select: { email: true, passwordHash: true } },
                        },
                    });
                    const now = new Date();
                    if (
                        !current ||
                        current.consumedAt ||
                        current.revokedAt ||
                        current.expiresAt <= now ||
                        !current.user.passwordHash ||
                        current.email !== current.user.email.trim().toLowerCase()
                    )
                        throw new IdentityError({ reason: 'password-recovery-invalid' });
                    await this.database.queryClient.passwordResetToken.update({
                        where: { id: reset.id },
                        data: { consumedAt: now },
                    });
                    await this.database.queryClient.user.update({
                        where: { id: reset.userId },
                        data: { passwordHash: hash },
                    });
                    await this.revokePendingCredentials(reset.userId, now);
                    return { userId: reset.userId };
                },
                { isolationLevel: 'ReadCommitted', propagation: 'mandatory' }
            )
        );
    }

    private async lockUser(userId: string): Promise<void> {
        await this.database.queryClient
            .$queryRaw`SELECT "id" FROM public."User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    }

    private readPreparedPassword(prepared: Identity.PreparedPassword): string {
        const hash = this.preparedPasswords.get(prepared);
        if (!hash)
            throw new TypeError('Prepared password does not belong to this Identity runtime');
        return hash;
    }

    private async writeFirstPassword(userId: string, hash: string, now: Date): Promise<void> {
        const updated = await this.database.queryClient.user.updateMany({
            where: { id: userId, passwordHash: null },
            data: { passwordHash: hash },
        });
        if (updated.count !== 1) throw new IdentityError({ reason: 'password-present' });
        await this.revokePendingCredentials(userId, now);
    }

    private async revokePendingCredentials(userId: string, now: Date): Promise<void> {
        await this.database.queryClient.userActivationToken.updateMany({
            where: { userId, consumedAt: null, revokedAt: null },
            data: { revokedAt: now },
        });
        await this.database.queryClient.passwordResetToken.updateMany({
            where: { userId, consumedAt: null, revokedAt: null },
            data: { revokedAt: now },
        });
    }
}
