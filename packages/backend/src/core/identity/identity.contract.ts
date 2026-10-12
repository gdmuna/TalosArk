export interface ExternalIdentityReference {
    issuer: string;
    subject: string;
}

export interface CreateOidcTransactionOutput {
    transactionId: string;
    url: string;
}

export interface ResolveOidcLoginCallbackInput {
    code: string;
    state: string;
    id: string;
}

export interface ResolveOidcLoginCallbackOutput {
    externalIdentity: ExternalIdentityReference;
    registration: {
        username?: string;
        email?: string;
        nickname?: string | null;
    };
}

export type UserProfileSex = 'MALE' | 'FEMALE' | 'OTHER';

export interface CreateUserProfileInput {
    nickname?: string | null;
    avatarId?: string | null;
    bio?: string | null;
    sex?: UserProfileSex | null;
    sexVisible?: boolean;
    birthday?: Date | null;
}

export interface UserProfileSnapshot {
    userId: string;
    nickname: string | null;
    avatarId: string | null;
    bio: string | null;
    sex: UserProfileSex | null;
    sexVisible: boolean;
    birthday: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface InternalUserSnapshot {
    id: string;
    username: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
    profile: UserProfileSnapshot | null;
}

/** Lookup only; an identity reference is not evidence of authentication. */
export type GetInternalUserInput =
    | { type: 'externalIdentity'; externalIdentity: ExternalIdentityReference }
    | { type: 'normal'; userId: string };

export type GetInternalUserOutput = InternalUserSnapshot | null;

/** Owned nested writes are atomic and join an ambient database transaction. */
export interface CreateInternalUserInput {
    username: string;
    email: string;
    passwordHash?: string | null;
    profile?: CreateUserProfileInput;
    externalIdentities?: readonly ExternalIdentityReference[];
}

export type CreateInternalUserOutput = InternalUserSnapshot;

export interface CreateExternalIdentityInput extends ExternalIdentityReference {
    userId: string;
}

export interface CreateExternalIdentityOutput extends ExternalIdentityReference {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}
