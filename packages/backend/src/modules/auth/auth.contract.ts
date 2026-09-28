import type * as Prisma from '@root/prisma/generated/models.js';
import type { CreateUserSessionOutput } from '@/core/access/access.contract.js';

import { Simplify } from '@/common/types/index.js';

import { VerifiedIamToken } from '@/infra/iam/iam-token.adapter.js';

export interface OidcLoginCallbackInput {
    code: string;
    state: string;
    id: string;
}

export type OidcLoginCallbackOutput = Simplify<
    OidcLoginCallbackSuccessOutput | OidcLoginCallbackBlockOutput
>;

export interface OidcLoginCallbackSuccessOutput {
    type: 'success';
    data: CreateUserSessionOutput;
}

export interface OidcLoginCallbackBlockOutput {
    type: 'block';
    data: Record<string, never>;
}
