import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { AccountProvisionInputSchema } from '@talos-ark/contracts/auth';
import { IdentityCredential } from '../../../../src/core/identity/internal/identity.credential.js';
import { DatabaseRuntime } from '../../../../src/infra/database/database.runtime.js';
import type { ProvisionAccountInput } from '../../../../src/core/identity/identity.contract.js';
import { accountsKind, accountReferenceSchema, accountProfile } from './account.kind.js';
import { SeedSecrets } from '../../runtime/secret.js';
import { type BusinessSeeder } from '../../runtime/handler.js';
import type { SeedExecution } from '../../runtime/execution.js';

@Injectable()
export class AccountSeeder implements BusinessSeeder<typeof accountsKind> {
    constructor(
        private readonly identity: IdentityCredential,
        private readonly database: DatabaseRuntime,
        private readonly secrets: SeedSecrets
    ) {}

    async seed(
        data: z.output<typeof accountsKind.data>,
        _input: z.output<typeof accountsKind.input>,
        execution: SeedExecution
    ) {
        const output: z.output<typeof accountsKind.output> = {};
        for (const item of data.accounts) {
            // The namespace hash bounds usernames and prevents accidental adoption of existing accounts.
            const suffix = execution.codePrefix.toLowerCase();
            const identity = AccountProvisionInputSchema.parse({
                username: `${suffix}-${item.input.username}`,
                email: `${suffix}.${item.input.email}`,
            } satisfies z.input<typeof AccountProvisionInputSchema>);
            const password =
                item.active && execution.mode === 'apply' ? this.secrets.password() : undefined;
            const preparedPassword = password
                ? await this.identity.preparePassword(password)
                : undefined;
            let activationToken: string | undefined;
            let created = false;
            const account = await execution.record({
                key: item.key,
                output: accountReferenceSchema,
                create: async () => {
                    const input = {
                        ...identity,
                        expiresAt: new Date(Date.now() + 7 * 86400000),
                        ...(item.profile ? { profile: accountProfile(item.profile) } : {}),
                    } satisfies ProvisionAccountInput;
                    const provisioned = await this.identity.provision(input);
                    if (preparedPassword)
                        await this.identity.activate({
                            token: provisioned.token,
                            preparedPassword,
                        });
                    else activationToken = provisioned.token;
                    created = true;
                    return { ...identity, userId: provisioned.userId, active: item.active };
                },
                inspect: async ({ userId }) => {
                    const { passwordHash, profile, ...user } =
                        await this.database.queryClient.user.findUniqueOrThrow({
                            where: { id: userId },
                            select: {
                                id: true,
                                username: true,
                                email: true,
                                passwordHash: true,
                                isSuperAdmin: true,
                                profile: {
                                    select: {
                                        nickname: true,
                                        bio: true,
                                        sex: true,
                                        sexVisible: true,
                                        birthday: true,
                                    },
                                },
                                activationTokens: {
                                    select: {
                                        id: true,
                                        consumedAt: true,
                                        revokedAt: true,
                                        expiresAt: true,
                                    },
                                    orderBy: { id: 'asc' },
                                },
                            },
                        });
                    if (user.isSuperAdmin || !!passwordHash !== item.active)
                        throw new Error(`Unexpected account state: ${item.key}`);
                    return { ...user, profile, passwordSet: !!passwordHash };
                },
            });
            if (created)
                this.secrets.account({ key: item.key, ...account, password, activationToken });
            output[item.key] = account;
        }
        return output;
    }
}
