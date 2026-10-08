import type * as Identity from './identity.contract.js';
import { identityOidcTransactionKey } from './identity.key.js';
import { IdentityError } from './identity.error.js';
import { DatabaseError } from '@/infra/database/prisma/prisma.error.js';
import { IamError } from '@/infra/iam/iam.error.js';
import { KvsError } from '@/infra/kvs/kvs.error.js';

import { createSecureRandomString } from '@/common/utils/index.js';

import { PrismaService } from '@/infra/database/prisma/prisma.service.js';
import { IamClient } from '@/infra/iam/index.js';
import { KvsClient } from '@/infra/kvs/index.js';

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class IdentityKernel {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly iamClient: IamClient,
        private readonly kvsClient: KvsClient
    ) {}

    async createOidcTransaction() {
        return this.execute(async () => {
            const transactionId = createSecureRandomString();
            const codeVerifier = createSecureRandomString();
            const nonce = createSecureRandomString();
            const state = createSecureRandomString();

            const codeChallenge = createHash('sha256')
                .update(codeVerifier, 'ascii')
                .digest('base64url');

            const url = this.iamClient.iamOidcAdapter.createAuthorizationUrl({
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

    async resolveOidcLoginCallback(dto: { code: string; state: string; id: string }) {
        return this.execute(async () => {
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

            const iamRes = await this.iamClient.iamOidcAdapter.exchangeAuthorizationCode({
                code: dto.code,
                codeVerifier,
            });

            const verifiedAccessToken = this.iamClient.iamTokenAdapter.verifyAccessToken(
                iamRes.accessToken
            );

            const verifiedIdToken = this.iamClient.iamTokenAdapter.verifyIdToken(iamRes.idToken, {
                expectedNonce: nonce,
            });

            if (!verifiedAccessToken || !verifiedIdToken) {
                throw new IdentityError({ reason: 'provider-response-invalid' });
            }

            return {
                ...iamRes,
                verifiedAccessToken,
                verifiedIdToken,
            };
        });
    }

    async getInternalUser(
        input: Identity.GetInternalUserInput
    ): Promise<Identity.GetInternalUserOutput> {
        return this.execute(async () => {
            const { type } = input;
            let user: Identity.GetInternalUserOutput = null;

            if (type === 'externalIdentity') {
                const externalIdentity = await this.prismaService.execute(() =>
                    this.prismaService.externalIdentity.findUnique({
                        where: {
                            issuer_subject: {
                                issuer: input.verifiedIdToken.issuer,
                                subject: input.verifiedIdToken.subject,
                            },
                        },
                        include: {
                            user: {
                                include: {
                                    profile: true,
                                },
                                omit: {
                                    passwordHash: true,
                                },
                            },
                        },
                    })
                );
                if (!externalIdentity?.user) return user;
                user = externalIdentity.user;
            }

            if (type === 'normal') {
                user = await this.prismaService.execute(() =>
                    this.prismaService.user.findUnique({
                        where: {
                            id: input.userId,
                        },
                        include: {
                            profile: true,
                        },
                        omit: {
                            passwordHash: true,
                        },
                    })
                );
            }

            return user;
        });
    }

    async createInternalUser(
        input: Identity.CreateInternalUserInput
    ): Promise<Identity.CreateInternalUserOutput> {
        return this.execute(
            () =>
                this.prismaService.execute(() =>
                    this.prismaService.user.create({
                        data: input,
                        include: {
                            profile: true,
                        },
                        omit: {
                            passwordHash: true,
                        },
                    })
                ),
            'user'
        );
    }

    async createExternalIdentity(
        input: Identity.CreateExternalIdentityInput
    ): Promise<Identity.CreateExternalIdentityOutput> {
        return this.execute(
            () =>
                this.prismaService.execute(() =>
                    this.prismaService.externalIdentity.create({
                        data: input,
                    })
                ),
            'identity'
        );
    }

    private async execute<T>(
        operation: () => PromiseLike<T>,
        conflict?: 'user' | 'identity'
    ): Promise<T> {
        try {
            return await operation();
        } catch (cause) {
            if (cause instanceof IamError) {
                const reasons = {
                    'grant-rejected': 'authorization-rejected',
                    unavailable: 'provider-unavailable',
                    'invalid-response': 'provider-response-invalid',
                    'not-configured': 'login-unavailable',
                    configuration: 'login-unavailable',
                    'request-failed': 'provider-response-invalid',
                } as const;
                throw new IdentityError({ reason: reasons[cause.failure.reason] }, { cause });
            }
            if (
                (cause instanceof KvsError || cause instanceof DatabaseError) &&
                cause.failure.reason === 'unavailable'
            ) {
                throw new IdentityError({ reason: 'login-unavailable' }, { cause });
            }
            if (cause instanceof DatabaseError && cause.failure.reason === 'unique-constraint') {
                const { model, fields, constraint } = cause.failure;
                const userConflict =
                    constraint === 'User_email_key' ||
                    constraint === 'User_username_key' ||
                    (model === 'User' &&
                        fields.length === 1 &&
                        fields.some((field) => field === 'email' || field === 'username'));
                if (conflict === 'user' && userConflict) {
                    throw new IdentityError({ reason: 'user-conflict' }, { cause });
                }
                const identityConflict =
                    constraint === 'ExternalIdentity_issuer_subject_key' ||
                    (model === 'ExternalIdentity' &&
                        fields.length === 2 &&
                        fields.includes('issuer') &&
                        fields.includes('subject'));
                if (conflict && identityConflict) {
                    throw new IdentityError({ reason: 'identity-conflict' }, { cause });
                }
            }
            throw cause;
        }
    }
}
