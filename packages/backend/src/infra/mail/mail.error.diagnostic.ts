import type { ErrorDiagnosticProjector } from '@/platform/error/error.diagnostic.js';
import { MailError, mailFailureMessage } from './mail.error.js';

export const projectMailError: ErrorDiagnosticProjector = (error) =>
    MailError.is(error)
        ? { message: mailFailureMessage(error.failure), operation: error.failure.operation }
        : undefined;
