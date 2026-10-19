import { FileError } from '@/core/file/index.js';
import { composeErrorMappers, defineErrorMapper } from '@/platform/error/index.js';
import { MaterialAttachmentError } from './material-attachment.error.js';

const fileMapper = defineErrorMapper(FileError, MaterialAttachmentError, (failure) => {
    switch (failure.reason) {
        case 'invalid-input':
        case 'invalid-parts':
        case 'invalid-state':
        case 'invalid-cursor':
            return { reason: 'invalid' as const };
        case 'unavailable':
            return { reason: 'unavailable' as const };
        case 'conflict':
            return { reason: 'conflict' as const };
        case 'expired':
            return { reason: 'expired' as const };
        case 'busy':
        case 'timeout':
            return { reason: 'busy' as const };
        case 'not-ready':
            return { reason: 'not-ready' as const };
        case 'format-not-allowed':
            return { reason: 'format' as const };
        case 'size-not-allowed':
            return { reason: 'size' as const };
        case 'size-mismatch':
        case 'checksum-mismatch':
            return { reason: 'integrity' as const };
        case 'resource-readonly':
            return { reason: 'readonly' as const };
        case 'in-use':
            return { reason: 'in-use' as const };
        default:
            return undefined;
    }
});

export const materialAttachmentErrors = composeErrorMappers([fileMapper]);
