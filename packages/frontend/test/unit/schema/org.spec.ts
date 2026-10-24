import { describe, it, expect } from 'vitest';
import {
    OrgSchema,
    CreateOrgFormSchema,
    OrgMemberSchema,
    PendingOrgUserSchema,
} from '@/schemas/org.schema';

const validOrg = {
    id: 'org-1',
    name: 'BioLab',
    description: 'A biochemistry lab',
    ownerId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
};

const validUserInfo = {
    id: 'user-1',
    username: 'labuser',
    nickname: null,
    email: 'lab@example.com',
};

describe('OrgSchema', () => {
    it('accepts a valid org object', () => {
        expect(OrgSchema.safeParse(validOrg).success).toBe(true);
    });

    it('accepts org with null description', () => {
        expect(OrgSchema.safeParse({ ...validOrg, description: null }).success).toBe(true);
    });

    it('rejects org missing required id', () => {
        const { id: _id, ...noId } = validOrg;
        expect(OrgSchema.safeParse(noId).success).toBe(false);
    });

    it('rejects org missing ownerId', () => {
        const { ownerId: _o, ...noOwner } = validOrg;
        expect(OrgSchema.safeParse(noOwner).success).toBe(false);
    });
});

describe('CreateOrgFormSchema', () => {
    it('accepts valid name only', () => {
        expect(CreateOrgFormSchema.safeParse({ name: 'NewOrg' }).success).toBe(true);
    });

    it('accepts name with description', () => {
        expect(CreateOrgFormSchema.safeParse({ name: 'NewOrg', description: 'desc' }).success).toBe(
            true
        );
    });

    it('rejects empty name', () => {
        expect(CreateOrgFormSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('rejects name exceeding 128 chars', () => {
        expect(CreateOrgFormSchema.safeParse({ name: 'A'.repeat(129) }).success).toBe(false);
    });

    it('rejects description exceeding 512 chars', () => {
        expect(
            CreateOrgFormSchema.safeParse({ name: 'Org', description: 'D'.repeat(513) }).success
        ).toBe(false);
    });
});

describe('OrgMemberSchema', () => {
    const validMember = {
        id: 'ou-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        user: validUserInfo,
    };

    it('accepts a valid MEMBER entry', () => {
        expect(OrgMemberSchema.safeParse(validMember).success).toBe(true);
    });

    it('accepts OWNER role', () => {
        expect(OrgMemberSchema.safeParse({ ...validMember, role: 'OWNER' }).success).toBe(true);
    });

    it('accepts ADMIN role', () => {
        expect(OrgMemberSchema.safeParse({ ...validMember, role: 'ADMIN' }).success).toBe(true);
    });

    it('rejects invalid role', () => {
        expect(OrgMemberSchema.safeParse({ ...validMember, role: 'SUPERUSER' }).success).toBe(
            false
        );
    });

    it('rejects with PENDING status (wrong schema)', () => {
        expect(OrgMemberSchema.safeParse({ ...validMember, status: 'PENDING' }).success).toBe(
            false
        );
    });

    it('requires user object', () => {
        const { user: _u, ...noUser } = validMember;
        expect(OrgMemberSchema.safeParse(noUser).success).toBe(false);
    });
});

describe('PendingOrgUserSchema', () => {
    const validPending = {
        id: 'ou-2',
        orgId: 'org-1',
        userId: 'user-2',
        role: 'MEMBER' as const,
        status: 'PENDING' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        user: validUserInfo,
    };

    it('accepts a valid pending entry', () => {
        expect(PendingOrgUserSchema.safeParse(validPending).success).toBe(true);
    });

    it('rejects with ACTIVE status (wrong schema)', () => {
        expect(PendingOrgUserSchema.safeParse({ ...validPending, status: 'ACTIVE' }).success).toBe(
            false
        );
    });

    it('rejects invalid role', () => {
        expect(PendingOrgUserSchema.safeParse({ ...validPending, role: 'UNKNOWN' }).success).toBe(
            false
        );
    });
});
