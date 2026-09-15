import type { Mocked } from 'vitest';

import {
    FileAccessDeniedException,
    FileRecordNotFoundException,
    FileStagingNotFoundException,
} from '@/core/file/file.exception.js';
import { FileKernel } from '@/core/file/file.kernel.js';
import { FileRepository } from '@/core/file/internal/file.repository.js';
import { StorageService } from '@/infra/storage/storage.service.js';

describe('FileKernel', () => {
    const file = {
        id: 'file_1',
        userId: 'owner_1',
        bucket: 'private',
        key: 'owner_1/file_1',
        filename: 'report.pdf',
        contentType: 'application/pdf',
        status: 'ACTIVE',
        visibility: 'PRIVATE',
    } as never;

    const fileRepository: Mocked<Pick<FileRepository, 'findById' | 'updateStatus'>> = {
        findById: vi.fn(),
        updateStatus: vi.fn(),
    };

    const storageService: Mocked<
        Pick<StorageService, 'getDownloadUrl' | 'getPublicUrl' | 'objectExists'>
    > = {
        getDownloadUrl: vi.fn(),
        getPublicUrl: vi.fn(),
        objectExists: vi.fn(),
    };

    let kernel: FileKernel;

    beforeEach(() => {
        vi.clearAllMocks();
        kernel = new FileKernel(
            storageService as unknown as StorageService,
            fileRepository as unknown as FileRepository,
            {} as never,
            {} as never,
            {} as never
        );
    });

    it('refuses to mint a private download URL for a different user', async () => {
        fileRepository.findById.mockResolvedValue(file);

        await expect(
            kernel.createDownloadUrl('other_user', { fileId: 'file_1', expiresIn: 60 })
        ).rejects.toBeInstanceOf(FileAccessDeniedException);
        expect(storageService.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('does not activate an upload whose object is absent from storage', async () => {
        fileRepository.findById.mockResolvedValue({ ...file, status: 'PENDING' } as never);
        storageService.objectExists.mockResolvedValue(false);

        await expect(kernel.confirmUpload('owner_1', { fileId: 'file_1' })).rejects.toBeInstanceOf(
            FileStagingNotFoundException
        );
        expect(fileRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('does not expose a private file through the public-url seam', async () => {
        fileRepository.findById.mockResolvedValue(file);

        await expect(kernel.getPublicUrl('file_1')).rejects.toBeInstanceOf(
            FileRecordNotFoundException
        );
        expect(storageService.getPublicUrl).not.toHaveBeenCalled();
    });
});
