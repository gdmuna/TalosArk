import type { ErrorDiagnosticProjector } from '@/platform/observability/logger/logger.diagnostic.js';
import { MailError } from './mail.error.js';

export const projectMailError: ErrorDiagnosticProjector = (error) => {
    if (!MailError.is(error)) return undefined;
    const { operation, phase, outcome, upstreamStatus } = error.failure;
    return {
        operation,
        phase,
        outcome,
        upstreamStatus:
            typeof upstreamStatus === 'number' &&
            Number.isInteger(upstreamStatus) &&
            upstreamStatus >= 100 &&
            upstreamStatus <= 599
                ? upstreamStatus
                : undefined,
    };
};

export default projectMailError;
