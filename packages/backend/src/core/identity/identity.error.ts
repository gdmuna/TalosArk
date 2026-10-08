export type IdentityFailure = {
    reason:
        | 'transaction-invalid'
        | 'authorization-rejected'
        | 'provider-unavailable'
        | 'provider-response-invalid'
        | 'login-unavailable'
        | 'user-conflict'
        | 'identity-conflict';
};

export class IdentityError extends Error {
    constructor(
        readonly failure: IdentityFailure,
        options?: ErrorOptions
    ) {
        super(`Identity operation failed: ${failure.reason}`, options);
        this.name = 'IdentityError';
    }
}
