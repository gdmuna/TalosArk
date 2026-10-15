import type { ErrorDiagnosticProjector } from '@/platform/observability/logger/logger.diagnostic.js';
import { IamError } from './iam.error.js';

const projectIamError: ErrorDiagnosticProjector = (error) => {
    if (!IamError.is(error)) return undefined;
    const { upstreamStatus } = error.failure;
    return {
        upstreamStatus:
            typeof upstreamStatus === 'number' &&
            Number.isInteger(upstreamStatus) &&
            upstreamStatus >= 100 &&
            upstreamStatus <= 599
                ? upstreamStatus
                : undefined,
    };
};

export default projectIamError;
