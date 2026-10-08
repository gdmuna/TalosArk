import { describe, it, expect } from 'vitest';
import { BoxSchema, ReagentSchema, BoxAliasSchema } from '@/schemas/box.schema';

describe('BoxSchema', () => {
    const validBox = {
        id: 'box-1',
        orgId: 'org-1',
        rootId: null,
        name: 'Freezer A',
        description: null,
        rows: 8,
        cols: 12,
        createdAt: '2024-01-01T00:00:00.000Z',
    };

    it('accepts a valid box object', () => {
        expect(BoxSchema.safeParse(validBox).success).toBe(true);
    });

    it('accepts box with non-null rootId', () => {
        expect(BoxSchema.safeParse({ ...validBox, rootId: 'box-root' }).success).toBe(true);
    });

    it('accepts box with description', () => {
        expect(BoxSchema.safeParse({ ...validBox, description: 'Cold storage' }).success).toBe(
            true
        );
    });

    it('rejects box with string rows', () => {
        expect(BoxSchema.safeParse({ ...validBox, rows: '8' }).success).toBe(false);
    });

    it('rejects box with string cols', () => {
        expect(BoxSchema.safeParse({ ...validBox, cols: '12' }).success).toBe(false);
    });

    it('rejects box missing orgId', () => {
        const { orgId: _o, ...noOrgId } = validBox;
        expect(BoxSchema.safeParse(noOrgId).success).toBe(false);
    });

    it('rejects box missing name', () => {
        const { name: _n, ...noName } = validBox;
        expect(BoxSchema.safeParse(noName).success).toBe(false);
    });
});

describe('ReagentSchema', () => {
    const validReagent = {
        id: 'reagent-1',
        nodeId: 'node-1',
        orgId: 'org-1',
        position: 'A1',
        name: 'Sample X',
        description: null,
    };

    it('accepts a valid reagent object', () => {
        expect(ReagentSchema.safeParse(validReagent).success).toBe(true);
    });

    it('accepts reagent with description', () => {
        expect(
            ReagentSchema.safeParse({ ...validReagent, description: 'Blood sample' }).success
        ).toBe(true);
    });

    it('rejects reagent missing position', () => {
        const { position: _p, ...noPos } = validReagent;
        expect(ReagentSchema.safeParse(noPos).success).toBe(false);
    });

    it('accepts reagent with missing nodeId (optional field)', () => {
        const { nodeId: _n, ...noNode } = validReagent;
        expect(ReagentSchema.safeParse(noNode).success).toBe(true);
    });
});

describe('BoxAliasSchema', () => {
    const validAlias = {
        id: 'alias-1',
        boxId: 'box-1',
        alias: 'Main Freezer',
        createdAt: '2024-01-01T00:00:00.000Z',
    };

    it('accepts a valid alias object', () => {
        expect(BoxAliasSchema.safeParse(validAlias).success).toBe(true);
    });

    it('rejects alias missing alias field', () => {
        const { alias: _a, ...noAlias } = validAlias;
        expect(BoxAliasSchema.safeParse(noAlias).success).toBe(false);
    });

    it('rejects alias missing boxId', () => {
        const { boxId: _b, ...noBox } = validAlias;
        expect(BoxAliasSchema.safeParse(noBox).success).toBe(false);
    });

    it('rejects alias missing createdAt', () => {
        const { createdAt: _c, ...noCreatedAt } = validAlias;
        expect(BoxAliasSchema.safeParse(noCreatedAt).success).toBe(false);
    });
});
