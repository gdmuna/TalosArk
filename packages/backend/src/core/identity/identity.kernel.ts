import { identityOidcTransactionKey } from './identity.key.js';

import { createSecureRandomString } from '@/common/utils/index.js';

import { IamClient } from '@/infra/iam/index.js';
import { KvsClient } from '@/infra/kvs/index.js';

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class IdentityKernel {
    constructor(
        private readonly iamClient: IamClient,
        private readonly kvsClient: KvsClient
    ) {}

    async createOidcTransaction() {
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

        if (!url) {
            throw new Error('wtf');
        }

        const key = identityOidcTransactionKey.buildCanonical({
            id: transactionId,
        }).serialized;

        const ok = await this.kvsClient.redisClient.hSetEx(
            key,
            {
                codeVerifier,
                nonce,
                state,
            },
            {
                expiration: {
                    type: 'PX',
                    value: 10 * 60 * 1000,
                },
            }
        );

        if (ok === 0) {
            throw new Error('wtf');
        }

        return {
            transactionId,
            url,
        };
    }

    async resolveOidcLoginCallback(dto: { code: string; state: string; id: string }) {
        const key = identityOidcTransactionKey.buildCanonical({
            id: dto.id,
        }).serialized;
        const kvsRes = await this.kvsClient.redisClient.hGetAll(key);
        const { codeVerifier, nonce, state } = kvsRes;

        if (dto.state !== state) {
            throw new Error('wtf');
        }

        const iamRes = await this.iamClient.iamOidcAdapter.exchangeAuthorizationCode({
            code: dto.code,
            codeVerifier,
        });

        if (!iamRes) {
            throw new Error('wtf');
        }

        const verifiedAccessToken = this.iamClient.iamTokenAdapter.verifyAccessToken(
            iamRes.accessToken
        );

        const verifiedIdToken = this.iamClient.iamTokenAdapter.verifyIdToken(iamRes.idToken, {
            expectedNonce: nonce,
        });

        if (!verifiedAccessToken || !verifiedIdToken) {
            throw new Error('wtf');
        }

        return iamRes;
    }
}
