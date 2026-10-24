import { MaterialAttachmentService } from '@/modules/material/application/material-attachment.service.js';
import type { FileUploadSnapshot } from '@/core/file/index.js';

const params = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
    materialId: '33333333-3333-4333-8333-333333333333',
    sessionId: '44444444-4444-4444-8444-444444444444',
};

describe('MaterialAttachmentService.progress', () => {
    it('binds the upload session request to the material resolved from the route', async () => {
        const inspectUpload = vi.fn().mockResolvedValue({
            session: {
                id: params.sessionId,
                status: 'open',
                mode: 'single',
                filename: 'spec.pdf',
                contentType: 'application/pdf',
                sizeBytes: '12',
                expiresAt: new Date('2026-10-19T00:00:00.000Z'),
                assetId: null,
                partSizeBytes: null,
                partCount: 1,
                completionParts: null,
                purpose: null,
            } satisfies FileUploadSnapshot,
            parts: [],
        });
        const service = Object.assign(Object.create(MaterialAttachmentService.prototype), {
            files: { inspectUpload },
            facts: {
                byId: vi.fn().mockResolvedValue({
                    id: params.materialId,
                    organizationId: params.organizationId,
                    workspaceId: params.workspaceId,
                    resourceId: '55555555-5555-4555-8555-555555555555',
                }),
            },
            actor: { requireActor: () => ({ userId: '66666666-6666-4666-8666-666666666666' }) },
        }) as MaterialAttachmentService;

        await service.progress(params);

        expect(inspectUpload).toHaveBeenCalledOnce();
        expect(inspectUpload).toHaveBeenCalledWith({
            organizationId: params.organizationId,
            userId: '66666666-6666-4666-8666-666666666666',
            sessionId: params.sessionId,
            expectedPurpose: {
                purposeKey: 'material.attachment',
                resourceId: '55555555-5555-4555-8555-555555555555',
            },
        });
    });
});
