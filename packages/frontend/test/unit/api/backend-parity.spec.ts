import { describe, it, expect } from 'vitest';
import { backendRoutes, frontendRoutes } from '../fixture/route-parity.fixture';

describe('backend/frontend route parity', () => {
    it('frontend should cover all required backend business routes', () => {
        const requiredMissing = backendRoutes.filter((route) => !frontendRoutes.includes(route));
        expect(requiredMissing).toEqual([]);
    });
});
