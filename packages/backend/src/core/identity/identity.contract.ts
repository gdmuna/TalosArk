import type * as Prisma from '@root/prisma/generated/models.js';

import { Simplify } from '@/common/types/index.js';

import { VerifiedIamToken } from '@/infra/iam/iam-token.adapter.js';

export type GetInternalUserInput = Simplify<GetInternalUserIdTokenInput | GetInternalUserIdInput>;

export type GetInternalUserOutput = Simplify<
    (Omit<Prisma.UserModel, 'passwordHash'> & { profile: Prisma.UserProfileModel | null }) | null
>;

export interface GetInternalUserIdTokenInput {
    type: 'externalIdentity';
    verifiedIdToken: VerifiedIamToken;
}

export interface GetInternalUserIdInput {
    type: 'normal';
    userId: string;
}

export type CreateInternalUserInput = Simplify<Omit<Prisma.UserCreateInput, 'sessions'>>;

export type CreateInternalUserOutput = Simplify<
    Omit<Prisma.UserModel, 'passwordHash'> & { profile: Prisma.UserProfileModel | null }
>;

export type CreateExternalIdentityInput = Simplify<Prisma.ExternalIdentityCreateInput>;

export type CreateExternalIdentityOutput = Simplify<Prisma.ExternalIdentityModel>;
