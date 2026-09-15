import type { Mocked } from 'vitest';
import { UserService } from '@/modules/user/internal/user.service.js';
import { UserRepository } from '@/modules/user/internal/user.repository.js';
import { EmailVerificationRepository } from '@/modules/user/internal/email-verification.repository.js';
import {
    UserNotFoundException,
    OldPasswordWrongException,
    EmailSameException,
    VerificationCodeInvalidException,
    VerificationCodeExpiredException,
} from '@/modules/user/user.exception.js';
import { MailService } from '@/infra/mail/mail.service.js';
import { IdentityKernel } from '@/core/identity/index.js';

import bcrypt from 'bcryptjs';

describe('UserService', () => {
    const passwordHash = bcrypt.hashSync('P@ssw0rd!', 10);

    const mockUserRepository: Mocked<
        Pick<UserRepository, 'findById' | 'findByEmail' | 'update' | 'search'>
    > = {
        findById: vi.fn(),
        findByEmail: vi.fn(),
        update: vi.fn(),
        search: vi.fn(),
    };

    const mockEvRepository: Mocked<
        Pick<EmailVerificationRepository, 'create' | 'findLatestByEmail' | 'deleteByEmail'>
    > = {
        create: vi.fn(),
        findLatestByEmail: vi.fn(),
        deleteByEmail: vi.fn(),
    };

    const mockMailService: Mocked<Pick<MailService, 'sendVerificationCode'>> = {
        sendVerificationCode: vi.fn(),
    };

    const mockIdentityKernel: Mocked<
        Pick<IdentityKernel, 'changePassword' | 'createSessionForVerifiedUser' | 'resetPassword'>
    > = {
        changePassword: vi.fn(),
        createSessionForVerifiedUser: vi.fn(),
        resetPassword: vi.fn(),
    };

    let service: UserService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIdentityKernel.changePassword.mockResolvedValue(true);
        mockIdentityKernel.createSessionForVerifiedUser.mockResolvedValue({
            accessToken: 'access_tok',
            refreshToken: 'refresh_tok',
            user: { id: 'u_01', username: 'test', email: 'test@example.com' },
        });
        mockIdentityKernel.resetPassword.mockResolvedValue(true);
        service = new UserService(
            mockUserRepository as unknown as UserRepository,
            mockEvRepository as unknown as EmailVerificationRepository,
            mockMailService as unknown as MailService,
            mockIdentityKernel as unknown as IdentityKernel
        );
    });

    describe('getMyInfo', () => {
        it('should return user info without passwordHash', async () => {
            mockUserRepository.findById.mockResolvedValue({
                id: 'u_1',
                username: 'test',
                email: 'test@example.com',
                passwordHash,
                nickname: 'Nick',
                realname: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.getMyInfo('u_1');
            expect(result).toMatchObject({ id: 'u_1', username: 'test', nickname: 'Nick' });
            expect(result).not.toHaveProperty('passwordHash');
        });

        it('should throw UserNotFoundException when user not found', async () => {
            mockUserRepository.findById.mockResolvedValue(null);
            await expect(service.getMyInfo('nonexistent')).rejects.toThrow(UserNotFoundException);
        });
    });

    describe('updateInfo', () => {
        it('should update nickname and realname', async () => {
            mockUserRepository.findById.mockResolvedValue({
                id: 'u_1',
                username: 'test',
                email: 'test@example.com',
                passwordHash,
                nickname: null,
                realname: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            mockUserRepository.update.mockResolvedValue({
                id: 'u_1',
                username: 'test',
                email: 'test@example.com',
                passwordHash,
                nickname: 'NewNick',
                realname: 'Real Name',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.updateInfo('u_1', {
                nickname: 'NewNick',
                realname: 'Real Name',
            });
            expect(result.nickname).toBe('NewNick');
            expect(result.realname).toBe('Real Name');
            expect(result).not.toHaveProperty('passwordHash');
        });
    });

    describe('updatePassword', () => {
        it('should update password when old password is correct', async () => {
            mockUserRepository.findById.mockResolvedValue({
                id: 'u_1',
                username: 'test',
                email: 'test@example.com',
                passwordHash,
                nickname: null,
                realname: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            await expect(
                service.updatePassword('u_1', {
                    oldPassword: 'P@ssw0rd!',
                    newPassword: 'NewP@ssw0rd!',
                })
            ).resolves.toBeUndefined();
            expect(mockIdentityKernel.changePassword).toHaveBeenCalledWith({
                userId: 'u_1',
                currentPassword: 'P@ssw0rd!',
                newPassword: 'NewP@ssw0rd!',
            });
        });

        it('should throw OldPasswordWrongException when old password is wrong', async () => {
            mockUserRepository.findById.mockResolvedValue({
                id: 'u_1',
                username: 'test',
                email: 'test@example.com',
                passwordHash,
                nickname: null,
                realname: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            mockIdentityKernel.changePassword.mockResolvedValue(false);

            await expect(
                service.updatePassword('u_1', {
                    oldPassword: 'WrongPass1',
                    newPassword: 'NewP@ssw0rd!',
                })
            ).rejects.toThrow(OldPasswordWrongException);
        });
    });

    describe('searchUsers', () => {
        it('should return search results excluding current user', async () => {
            mockUserRepository.search.mockResolvedValue([
                { id: 'u_2', username: 'other', nickname: null, email: 'other@example.com' },
            ]);

            const result = await service.searchUsers('other', 'u_1', 10);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('u_2');
            expect(mockUserRepository.search).toHaveBeenCalledWith('other', 'u_1', 10);
        });
    });

    describe('updateEmail', () => {
        it('should throw EmailSameException when new email equals current', async () => {
            mockUserRepository.findById.mockResolvedValue({
                id: 'u_1',
                username: 'test',
                email: 'test@example.com',
                passwordHash,
                nickname: null,
                realname: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await expect(service.updateEmail('u_1', 'test@example.com', '123456')).rejects.toThrow(
                EmailSameException
            );
        });
    });

    describe('sendEmailCode', () => {
        it('should delete old code, save new code, and send email', async () => {
            mockEvRepository.deleteByEmail.mockResolvedValue(undefined as any);
            mockEvRepository.create.mockResolvedValue({ id: 'ev_01' } as any);
            mockMailService.sendVerificationCode.mockResolvedValue(undefined);

            const result = await service.sendEmailCode('test@example.com');
            expect(mockEvRepository.deleteByEmail).toHaveBeenCalledWith('test@example.com');
            expect(mockEvRepository.create).toHaveBeenCalled();
            expect(mockMailService.sendVerificationCode).toHaveBeenCalledWith(
                'test@example.com',
                expect.stringMatching(/^\d{6}$/)
            );
            expect(result).toEqual({ sent: true });
        });
    });

    describe('emailLogin', () => {
        it('should return accessToken, refreshToken, and user on valid code', async () => {
            const futureDate = new Date(Date.now() + 5 * 60 * 1000);
            mockEvRepository.findLatestByEmail.mockResolvedValue({
                code: '123456',
                expiresAt: futureDate,
            } as any);
            mockUserRepository.findByEmail.mockResolvedValue({
                id: 'u_01',
                email: 'test@example.com',
                passwordHash: 'hash',
                username: 'test',
                nickname: null,
                realname: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any);
            mockEvRepository.deleteByEmail.mockResolvedValue(undefined as any);

            const result = await service.emailLogin('test@example.com', '123456');
            expect(result).not.toHaveProperty('passwordHash');
            expect(result.accessToken).toBe('access_tok');
            expect(result.refreshToken).toBe('refresh_tok');
            expect(result.user.id).toBe('u_01');
            expect(mockIdentityKernel.createSessionForVerifiedUser).toHaveBeenCalledWith({
                userId: 'u_01',
            });
        });

        it('should throw VerificationCodeInvalidException on wrong code', async () => {
            mockEvRepository.findLatestByEmail.mockResolvedValue({
                code: '999999',
                expiresAt: new Date(Date.now() + 60000),
            } as any);
            await expect(service.emailLogin('test@example.com', '000000')).rejects.toThrow(
                VerificationCodeInvalidException
            );
        });

        it('should throw VerificationCodeExpiredException on expired code', async () => {
            const pastDate = new Date(Date.now() - 1000);
            mockEvRepository.findLatestByEmail.mockResolvedValue({
                code: '123456',
                expiresAt: pastDate,
            } as any);
            await expect(service.emailLogin('test@example.com', '123456')).rejects.toThrow(
                VerificationCodeExpiredException
            );
        });
    });
});
