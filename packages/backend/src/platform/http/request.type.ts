/** Verified request identity; token claims and credentials stay outside business handlers. */
export interface RequestAuthentication {
    readonly userId: string;
    readonly sessionId: string;
}
