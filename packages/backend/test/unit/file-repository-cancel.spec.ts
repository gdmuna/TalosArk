import { FileRepository } from '@/core/file/internal/file.repository.js';
import type { FileUploadRequest } from '@/core/file/file.contract.js';
import { FileError } from '@/core/file/file.error.js';
import type { FileUploadSession } from '@root/prisma/generated/client.js';

const request: FileUploadRequest = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    sessionId: '44444444-4444-4444-8444-444444444444',
    expectedPurpose: {
        purposeKey: 'material.attachment',
        resourceId: '33333333-3333-4333-8333-333333333333',
    },
};

function session(status: FileUploadSession['status'] = 'OPEN') {
    return {
        id: request.sessionId,
        organizationId: request.organizationId,
        uploadedById: request.userId,
        purposeKey: request.expectedPurpose?.purposeKey,
        resourceId: request.expectedPurpose?.resourceId,
        status,
        leaseToken: 'lease',
        leaseUntil: new Date(),
    } as FileUploadSession;
}

function createRepository(rows: FileUploadSession[], events: string[]) {
    const fileUploadSession = {
        findFirst: vi.fn(async () => {
            events.push('read');
            return rows.shift() ?? null;
        }),
        update: vi.fn(async ({ data }: { data: Partial<FileUploadSession> }) => {
            events.push('update');
            return { ...session(), ...data };
        }),
    };
    const database = {
        transaction: { run: (work: () => Promise<unknown>) => work() },
        queryClient: {
            fileUploadSession,
            $queryRaw: async () => {
                events.push('lock');
                return [];
            },
        },
    };
    const organization = {
        requireMembership: async () => {
            events.push('member');
        },
    };
    const purposes = {
        session: async () => {
            events.push('authorize');
        },
    };
    const repository = Object.assign(Object.create(FileRepository.prototype), {
        database,
        organization,
        purposes,
    }) as FileRepository;

    return { repository, fileUploadSession, purposes };
}

describe('FileRepository.cancel', () => {
    it('authorizes before locking and mutating the upload session', async () => {
        const events: string[] = [];
        const { repository, fileUploadSession, purposes } = createRepository([session()], events);
        vi.spyOn(purposes, 'session').mockRejectedValueOnce(
            new FileError({ reason: 'unavailable' })
        );

        await expect(repository.cancel(request)).rejects.toMatchObject({
            failure: { reason: 'unavailable' },
        });

        expect(events).toEqual(['member', 'read']);
        expect(fileUploadSession.update).not.toHaveBeenCalled();
    });

    it('locks then rereads status before cancellation and clears the lease', async () => {
        const events: string[] = [];
        const { repository, fileUploadSession } = createRepository([session(), session()], events);

        const result = await repository.cancel(request);

        expect(events).toEqual(['member', 'read', 'authorize', 'lock', 'read', 'update']);
        expect(fileUploadSession.update).toHaveBeenCalledWith({
            where: { id: request.sessionId },
            data: { status: 'CANCELLED', leaseToken: null, leaseUntil: null },
        });
        expect(result.status).toBe('CANCELLED');
    });

    it('rejects a session completed while cancellation waited for its lock', async () => {
        const events: string[] = [];
        const { repository, fileUploadSession } = createRepository(
            [session(), session('COMPLETED')],
            events
        );

        await expect(repository.cancel(request)).rejects.toMatchObject({
            failure: { reason: 'invalid-state' },
        });

        expect(events).toEqual(['member', 'read', 'authorize', 'lock', 'read']);
        expect(fileUploadSession.update).not.toHaveBeenCalled();
    });
});
