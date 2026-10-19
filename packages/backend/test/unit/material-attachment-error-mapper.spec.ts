import { FileError } from '@/core/file/file.error.js';
import { MaterialAttachmentError } from '@/modules/material/application/material-attachment.error.js';
import { materialAttachmentErrors } from '@/modules/material/application/material-attachment.error.mapper.js';

describe('material attachment error mapping', () => {
    it('maps content integrity failures to the public integrity error', () => {
        const mapped = materialAttachmentErrors.map(new FileError({ reason: 'checksum-mismatch' }));

        expect(MaterialAttachmentError.is(mapped, 'integrity')).toBe(true);
    });

    it.each(['transaction-active', 'unknown-purpose', 'purpose-not-ready'] as const)(
        'preserves technical %s errors unchanged',
        (reason) => {
            const error = new FileError({ reason });

            expect(materialAttachmentErrors.map(error)).toBe(error);
        }
    );
});
