import type { FileUploadSession } from '@root/prisma/generated/client.js';
import { FileError } from '@/core/file/file.error.js';
import { FilePurposePolicy } from '@/core/file/purpose/file-purpose.policy.js';

const actor = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
};
const materialId = '33333333-3333-4333-8333-333333333333';

function createPolicy() {
    const authorize = vi.fn().mockResolvedValue({ definition: { maxSizeBytes: 1024 } });
    const admit = vi.fn();
    const policy = Object.assign(Object.create(FilePurposePolicy.prototype), {
        authorize,
        admit,
    }) as FilePurposePolicy;
    return { policy, authorize, admit };
}

function uploadSession(overrides: Partial<FileUploadSession> = {}) {
    return {
        purposeKey: 'material.attachment',
        resourceId: materialId,
        status: 'OPEN',
        filename: 'spec.pdf',
        contentType: 'application/pdf',
        expectedSizeBytes: 12n,
        ...overrides,
    } as FileUploadSession;
}

describe('FilePurposePolicy.session', () => {
    it('rejects a session for another URL material before authorization or storage effects', async () => {
        const { policy, authorize, admit } = createPolicy();

        await expect(
            policy.session(
                {
                    ...actor,
                    sessionId: '44444444-4444-4444-8444-444444444444',
                    expectedPurpose: {
                        purposeKey: 'material.attachment',
                        resourceId: '55555555-5555-4555-8555-555555555555',
                    },
                },
                uploadSession()
            )
        ).rejects.toMatchObject({ failure: { reason: 'unavailable' } });

        expect(authorize).not.toHaveBeenCalled();
        expect(admit).not.toHaveBeenCalled();
    });

    it('accepts canonical UUID casing and then checks the current purpose authorization', async () => {
        const { policy, authorize, admit } = createPolicy();

        await policy.session(
            {
                ...actor,
                sessionId: '44444444-4444-4444-8444-444444444444',
                expectedPurpose: {
                    purposeKey: 'material.attachment',
                    resourceId: materialId.toUpperCase(),
                },
            },
            uploadSession()
        );

        expect(authorize).toHaveBeenCalledOnce();
        expect(admit).toHaveBeenCalledOnce();
    });

    it('does not weaken technical purpose-registration errors into business errors', async () => {
        const { policy, authorize, admit } = createPolicy();
        authorize.mockRejectedValueOnce(new FileError({ reason: 'unknown-purpose' }));

        await expect(
            policy.session(
                {
                    ...actor,
                    sessionId: '44444444-4444-4444-8444-444444444444',
                    expectedPurpose: { purposeKey: 'material.attachment', resourceId: materialId },
                },
                uploadSession()
            )
        ).rejects.toMatchObject({ failure: { reason: 'unknown-purpose' } });
        expect(admit).not.toHaveBeenCalled();
    });
});
