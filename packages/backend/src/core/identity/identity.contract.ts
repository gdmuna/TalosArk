export interface ExternalIdentityReference {
    issuer: string;
    subject: string;
}

export interface ProvisionAccountInput {
    username: string;
    email: string;
    expiresAt: Date;
    profile?: CreateUserProfileInput;
}
export interface ProvisionAccountOutput {
    userId: string;
    token: string;
    expiresAt: Date;
}
export interface AuthenticateAccountInput {
    identifier: string;
    password: string;
}
/** Internal proof for an immediate, transaction-bound recheck; never publish or log it. */
export interface AuthenticatedAccount {
    userId: string;
    credentialVersion: string;
}
declare const preparedPassword: unique symbol;
/** Process-local opaque password preparation; never publish, persist or log it. */
export interface PreparedPassword {
    readonly [preparedPassword]: true;
}

/** Credential writes join Auth's transaction, which also owns session revocation. */
export interface ActivateAccountInput {
    token: string;
    preparedPassword: PreparedPassword;
}
export interface ActivateAccountOutput {
    userId: string;
}
export interface SetFirstPasswordInput {
    userId: string;
    preparedPassword: PreparedPassword;
}

export interface IssuePasswordRecoveryInput {
    email: string;
    expiresAt: Date;
}
/** Internal mail delivery only; never return this credential over HTTP or log it. */
export interface IssuedPasswordRecovery {
    id: string;
    email: string;
    token: string;
    expiresAt: Date;
}
export interface ConfirmPasswordRecoveryInput {
    token: string;
    preparedPassword: PreparedPassword;
}
export interface ConfirmPasswordRecoveryOutput {
    userId: string;
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
