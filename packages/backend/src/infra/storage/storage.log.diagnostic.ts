import type { ErrorDiagnosticProjector } from '@/platform/observability/logger/logger.diagnostic.js';
import { StorageError } from './storage.error.js';

const projectStorageError: ErrorDiagnosticProjector = (error) =>
    StorageError.is(error) ? { operation: error.failure.operation } : undefined;

export default projectStorageError;
