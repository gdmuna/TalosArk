import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

import api from '@/shared/api/client';
import {
    createBoxImage,
    listBoxImages,
    compareBoxImage,
    deleteBoxImage,
} from '@/shared/api/module/box-image';

describe('box-image API module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls Post /box/image/add', () => {
        const data = { boxId: 'box-1', imageUrl: 'https://example.com/a.png' };
        createBoxImage(data);
        expect(api.post).toHaveBeenCalledWith('/box/image/add', data);
    });

    it('calls Get /box/image/list', () => {
        listBoxImages('box-1');
        expect(api.get).toHaveBeenCalledWith('/box/image/list', {
            params: { boxId: 'box-1' },
        });
    });

    it('calls Post /box/image/compare', () => {
        const data = { boxId: 'box-1', imageUrl: 'https://example.com/a.png' };
        compareBoxImage(data);
        expect(api.post).toHaveBeenCalledWith('/box/image/compare', data);
    });

    it('calls Delete /box/image/del', () => {
        deleteBoxImage('img-1');
        expect(api.delete).toHaveBeenCalledWith('/box/image/del', { id: 'img-1' });
    });
});
