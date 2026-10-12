import jwt from 'jsonwebtoken';
import { createPublicKey, type KeyObject } from 'node:crypto';
import type { CasdoorIamOptions } from '../iam.options.js';
import { IamError } from '../iam.error.js';

interface VerifiedToken {
    issuer: string;
    subject: string;
    claims: Readonly<Record<string, unknown>>;
}

/** Internal verifier; raw claims and decoded tokens never leave the IAM implementation. */
export class CasdoorTokenVerifier {
    private readonly publicKey: KeyObject;

    constructor(private readonly options: Readonly<CasdoorIamOptions>) {
        try {
            this.publicKey = createPublicKey(options.certificate);
        } catch (cause) {
            throw new IamError({ reason: 'configuration' }, { cause });
        }
        if (this.publicKey.asymmetricKeyType !== 'rsa') {
            throw new IamError({ reason: 'configuration' });
        }
    }

    verifyAccessToken(token: string): boolean {
        return this.verifyToken(token) !== null;
    }

    verifyIdToken(token: string, expectedNonce: string): VerifiedToken | null {
        const verified = this.verifyToken(token);
        if (!expectedNonce || verified?.claims.nonce !== expectedNonce) return null;
        return verified;
    }

    private verifyToken(token: string): VerifiedToken | null {
        try {
            const claims: unknown = jwt.verify(token, this.publicKey, {
                algorithms: ['RS256'],
                issuer: this.options.issuer,
                audience: this.options.clientId,
            });
            if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) return null;
            const fields = claims as Record<string, unknown>;
            if (
                typeof fields.iss !== 'string' ||
                typeof fields.sub !== 'string' ||
                !fields.sub ||
                typeof fields.exp !== 'number' ||
                typeof fields.iat !== 'number' ||
                (fields.azp !== undefined && fields.azp !== this.options.clientId)
            ) {
                return null;
            }
            const audience = fields.aud;
            if (
                audience !== this.options.clientId &&
                (!Array.isArray(audience) ||
                    audience.length !== 1 ||
                    audience[0] !== this.options.clientId)
            ) {
                return null;
            }
            return { issuer: fields.iss, subject: fields.sub, claims: fields };
        } catch (error) {
            if (
                error instanceof jwt.JsonWebTokenError ||
                error instanceof jwt.TokenExpiredError ||
                error instanceof jwt.NotBeforeError
            ) {
                return null;
            }
            throw error;
        }
    }
}
