import { describe, it, expect } from 'vitest';
import { LoginFormSchema, RegisterFormSchema, UserInfoSchema } from '@/schemas/user.schema';

describe('LoginFormSchema', () => {
    it('accepts valid account + password', () => {
        const result = LoginFormSchema.safeParse({ account: 'testuser', password: 'password123' });
        expect(result.success).toBe(true);
    });

    it('rejects missing account field', () => {
        const result = LoginFormSchema.safeParse({ password: 'password123' });
        expect(result.success).toBe(false);
    });

    it('rejects account shorter than 3 chars', () => {
        const result = LoginFormSchema.safeParse({ account: 'ab', password: 'password123' });
        expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 chars', () => {
        const result = LoginFormSchema.safeParse({ account: 'validuser', password: 'short' });
        expect(result.success).toBe(false);
    });
});

describe('RegisterFormSchema', () => {
    it('accepts valid username, email, and password', () => {
        const result = RegisterFormSchema.safeParse({
            username: 'newuser',
            email: 'new@example.com',
            password: 'securepassword',
        });
        expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
        const result = RegisterFormSchema.safeParse({
            username: 'newuser',
            email: 'not-an-email',
            password: 'securepassword',
        });
        expect(result.success).toBe(false);
    });

    it('rejects username shorter than 3 chars', () => {
        const result = RegisterFormSchema.safeParse({
            username: 'ab',
            email: 'new@example.com',
            password: 'securepassword',
        });
        expect(result.success).toBe(false);
    });
});

describe('UserInfoSchema', () => {
    it('parses valid user info', () => {
        const result = UserInfoSchema.safeParse({
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            nickname: null,
            realname: 'Test User',
            createdAt: '2024-01-01T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });

    it('requires createdAt field', () => {
        const result = UserInfoSchema.safeParse({
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            nickname: null,
            realname: null,
        });
        expect(result.success).toBe(false);
    });
});
