import { describe, it, expect } from 'vitest';
import { RootSchema } from '@/schemas/root.schema';

describe('RootSchema', () => {
    it('parses root payload from backend', () => {
        const parsed = RootSchema.safeParse({
            id: 'r1',
            orgId: 'o1',
            name: 'A区',
            description: null,
            createdAt: '2026-01-01',
        });
        expect(parsed.success).toBe(true);
    });
});
