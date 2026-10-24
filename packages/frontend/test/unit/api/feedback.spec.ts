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
import { listBoxLogs, listReagentLogs, createFeedback } from '@/shared/api/module/feedback';

describe('feedback API module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls Get /box/log/list with params', () => {
        const params = { boxId: 'box-1', limit: 20, offset: 0 };
        listBoxLogs(params);
        expect(api.get).toHaveBeenCalledWith('/box/log/list', { params });
    });

    it('calls Get /box/log/reagent/list with params', () => {
        const params = { reagentId: 'r-1', limit: 20, offset: 0 };
        listReagentLogs(params);
        expect(api.get).toHaveBeenCalledWith('/box/log/reagent/list', { params });
    });

    it('calls Post /feedback/add', () => {
        const data = { content: '反馈内容' };
        createFeedback(data);
        expect(api.post).toHaveBeenCalledWith('/feedback/add', data);
    });
});
