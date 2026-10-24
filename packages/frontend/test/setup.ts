import { vi } from 'vitest';

// Stub the axios-based API client so tests don't need a real HTTP adapter.
// Each test suite can override this with its own vi.mock('@/shared/api/client', ...) if needed.
vi.mock('@/shared/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));
