export type AccessFailure = {
    reason: 'session-inactive' | 'refresh-token-reused' | 'session-unavailable';
};

export class AccessError extends Error {
    constructor(
        readonly failure: AccessFailure,
        options?: ErrorOptions
    ) {
        super(`Access operation failed: ${failure.reason}`, options);
        this.name = 'AccessError';
    }
}
