import type { ErrorDiagnosticProjector } from '@/platform/observability/logger/logger.diagnostic.js';
import { HttpError } from './http.error.js';

const projectHttpError: ErrorDiagnosticProjector = (error) => {
    if (!HttpError.is(error)) return undefined;
    const { operation, upstreamStatus } = error.failure;
    return {
        operation: /^[A-Za-z0-9_.:-]{1,100}$/.test(operation) ? operation : undefined,
        upstreamStatus:
            typeof upstreamStatus === 'number' &&
            Number.isInteger(upstreamStatus) &&
            upstreamStatus >= 100 &&
            upstreamStatus <= 599
                ? upstreamStatus
                : undefined,
    };
};

export default projectHttpError;
