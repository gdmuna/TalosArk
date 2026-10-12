import type * as Identity from './identity.contract.js';
import type { Prisma } from '@root/prisma/generated/client.js';
import { identityOidcTransactionKey } from './identity.key.js';
import { IdentityError } from './identity.error.js';
import { identityErrors } from './identity.error.mapper.js';

import { createSecureRandomString } from '@/common/utils/crypto.js';

import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { CasdoorOidcClient } from '@/infra/iam/index.js';
import { KvsClient } from '@/infra/kvs/index.js';

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

const userSelect = {
    id: true,
    username: true,
    email: true,
    createdAt: true,
    updatedAt: true,
    profile: {
        select: {
            userId: true,
            nickname: true,
            avatarId: true,
            bio: true,
            sex: true,
            sexVisible: true,
            birthday: true,
            createdAt: true,
            updatedAt: true,
        },
    },
} satisfies Prisma.UserSelect;

const externalIdentitySelect = {
    id: true,
    issuer: true,
    subject: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.ExternalIdentitySelect;

@Injectable()
export class IdentityKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly oidc: CasdoorOidcClient,
        private readonly kvsClient: KvsClient
    ) {}

    async createOidcTransaction(): Promise<Identity.CreateOidcTransactionOutput> {
        return identityErrors.run(async () => {
            const transactionId = createSecureRandomString();
            const codeVerifier = createSecureRandomString();
            const nonce = createSecureRandomString();
            const state = createSecureRandomString();

            const codeChallenge = createHash('sha256')
                .update(codeVerifier, 'ascii')
                .digest('base64url');

            const url = this.oidc.createAuthorizationUrl({
                state,
                nonce,
                codeChallenge,
            });

            const key = identityOidcTransactionKey.buildCanonical({
                id: transactionId,
            }).serialized;

            const ok = await this.kvsClient.execute(() =>
                this.kvsClient.redisClient.hSetEx(
                    key,
                    {
                        codeVerifier,
                        nonce,
                        state,
                    },
                    {
                        expiration: {
                            type: 'EX',
                            value: 10 * 60,
                        },
                    }
                )
            );

            if (ok === 0) {
                throw new IdentityError({ reason: 'login-unavailable' });
            }

            return {
                transactionId,
                url,
            };
        });
    }

    async resolveOidcLoginCallback(
        dto: Identity.ResolveOidcLoginCallbackInput
    ): Promise<Identity.ResolveOidcLoginCallbackOutput> {
        return identityErrors.run(async () => {
            const key = identityOidcTransactionKey.buildCanonical({
                id: dto.id,
            }).serialized;
            const kvsRes = await this.kvsClient.execute(() =>
                this.kvsClient.hAtomic.getAllAndDelete(key)
            );
            const { codeVerifier, nonce, state } = kvsRes;

            if (!codeVerifier || !nonce || !state || dto.state !== state) {
                throw new IdentityError({ reason: 'transaction-invalid' });
            }

            const verified = await this.oidc.resolveIdentity({
                code: dto.code,
                codeVerifier,
                expectedNonce: nonce,
            });
            return {
                externalIdentity: { issuer: verified.issuer, subject: verified.subject },
                registration: {
                    username: verified.profile.username,
                    email: verified.profile.email,
                    nickname: verified.profile.nickname,
                },
            };
        });
    }

    async getInternalUser(
        input: Identity.GetInternalUserInput
    ): Promise<Identity.GetInternalUserOutput> {
        return identityErrors.run(async () => {
            const { type } = input;
            let user: Identity.GetInternalUserOutput = null;

            if (type === 'externalIdentity') {
                const externalIdentity =
                    await this.database.queryClient.externalIdentity.findUnique({
                        where: {
                            issuer_subject: {
                                issuer: input.externalIdentity.issuer,
                                subject: input.externalIdentity.subject,
                            },
                        },
                        select: {
                            user: {
                                select: userSelect,
                            },
                        },
                    });
                if (!externalIdentity?.user) return user;
                user = externalIdentity.user;
            }

            if (type === 'normal') {
                user = await this.database.queryClient.user.findUnique({
                    where: {
                        id: input.userId,
                    },
                    select: userSelect,
                });
            }

            return user;
        });
    }

    async createInternalUser(
        input: Identity.CreateInternalUserInput
    ): Promise<Identity.CreateInternalUserOutput> {
        return identityErrors.run(() =>
            this.database.queryClient.user.create({
                data: {
                    username: input.username,
                    email: input.email,
                    passwordHash: input.passwordHash,
                    profile: input.profile
                        ? {
                              create: {
                                  nickname: input.profile.nickname,
                                  avatarId: input.profile.avatarId,
                                  bio: input.profile.bio,
                                  sex: input.profile.sex,
                                  sexVisible: input.profile.sexVisible,
                                  birthday: input.profile.birthday,
                              },
                          }
                        : undefined,
                    externalIdentities: input.externalIdentities
                        ? {
                              create: input.externalIdentities.map(({ issuer, subject }) => ({
                                  issuer,
                                  subject,
                              })),
                          }
                        : undefined,
                },
                select: userSelect,
            })
        );
    }

    async createExternalIdentity(
        input: Identity.CreateExternalIdentityInput
    ): Promise<Identity.CreateExternalIdentityOutput> {
        return identityErrors.run(() =>
            this.database.queryClient.externalIdentity.create({
                data: {
                    issuer: input.issuer,
                    subject: input.subject,
                    user: { connect: { id: input.userId } },
                },
                select: externalIdentitySelect,
            })
        );
    }
}
