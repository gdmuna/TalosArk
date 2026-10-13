import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

export type MailPhase = 'configuration' | 'connect' | 'authenticate' | 'send' | 'close';
export type MailOutcome = 'not-sent' | 'rejected' | 'unknown';
export type MailFailure = {
    reason:
        | 'configuration'
        | 'invalid-request'
        | 'unavailable'
        | 'rejected'
        | 'timeout'
        | 'cancelled'
        | 'busy'
        | 'closed'
        | 'close-timeout'
        | 'invalid-response';
    operation: 'verify' | 'send' | 'close' | 'configure';
    phase: MailPhase;
    outcome: MailOutcome;
    upstreamStatus?: number;
    invalidFields?: readonly string[];
};

export function mailFailureMessage(failure: MailFailure): string {
    const message = {
        configuration: 'SMTP configuration or authentication is invalid',
        'invalid-request': 'Mail message is invalid',
        unavailable: 'SMTP is unavailable',
        rejected: 'SMTP message rejected',
        timeout: 'SMTP operation timed out',
        cancelled: 'SMTP operation cancelled',
        busy: 'SMTP concurrent operation limit reached',
        closed: 'SMTP client is closed',
        'close-timeout': 'SMTP shutdown deadline exceeded',
        'invalid-response': 'SMTP response is invalid',
    }[failure.reason];
    const fields = failure.invalidFields?.filter((field) => /^[A-Za-z]{1,30}$/.test(field));
    const context = fields?.length ? ` (${fields.join(', ')})` : '';
    const outcome = failure.outcome === 'unknown' ? '; SMTP acceptance is unknown' : '';
    return `${message}${context}${outcome}`;
}

const catalog = defineInternalErrorCatalog('mail', [
    'configuration',
    'invalid-request',
    'unavailable',
    'rejected',
    'timeout',
    'cancelled',
    'busy',
    'closed',
    'close-timeout',
    'invalid-response',
]);

export const MailError = defineErrorClass<typeof catalog, MailFailure>(catalog, {
    name: 'MailError',
    diagnosticMessage: mailFailureMessage,
});
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type MailError = InstanceType<typeof MailError>;
