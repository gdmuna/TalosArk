import { MailError, type MailFailure, type MailPhase } from './mail.error.js';

const networkCodes = new Set([
    'ECONNECTION',
    'ESOCKET',
    'EDNS',
    'EPROTOCOL',
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
]);
const configurationCodes = new Set([
    'EAUTH',
    'ENOAUTH',
    'ECONFIG',
    'ETLS',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'CERT_HAS_EXPIRED',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export function mailOutcome(phase: MailPhase): 'not-sent' | 'unknown' {
    return phase === 'send' ? 'unknown' : 'not-sent';
}

export function normalizeMailError(
    error: unknown,
    operation: 'verify' | 'send',
    phase: MailPhase
): MailError | undefined {
    if (MailError.is(error)) return error;
    if (!(error instanceof Error)) return undefined;
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    const response = 'responseCode' in error ? error.responseCode : undefined;
    const upstreamStatus =
        typeof response === 'number' &&
        Number.isInteger(response) &&
        response >= 400 &&
        response <= 599
            ? response
            : undefined;
    const command = 'command' in error ? error.command : undefined;
    // Nodemailer overwrites Node's hostname-mismatch code with ESOCKET, retaining cert/reason.
    const certificateMismatch =
        code === 'ESOCKET' &&
        'cert' in error &&
        typeof error.cert === 'object' &&
        error.cert !== null &&
        'reason' in error &&
        typeof error.reason === 'string';
    let reason: MailFailure['reason'];
    let outcome: MailFailure['outcome'] = mailOutcome(phase);
    if (upstreamStatus !== undefined) {
        reason =
            upstreamStatus >= 500 && code !== undefined && configurationCodes.has(code)
                ? 'configuration'
                : upstreamStatus < 500
                  ? 'unavailable'
                  : 'rejected';
        outcome = phase === 'send' ? 'rejected' : 'not-sent';
    } else if (certificateMismatch || (code && configurationCodes.has(code))) {
        reason = 'configuration';
    } else if (code === 'ETIMEDOUT') {
        reason = 'timeout';
    } else if (code && networkCodes.has(code)) {
        reason = 'unavailable';
    } else if (code === 'EENVELOPE' || code === 'EMESSAGE' || code === 'ESTREAM') {
        reason = 'invalid-request';
    } else {
        return undefined;
    }
    if (upstreamStatus === undefined && (command === 'MAIL FROM' || command === 'RCPT TO')) {
        outcome = 'not-sent';
    }
    return new MailError({ reason, operation, phase, outcome, upstreamStatus }, { cause: error });
}
