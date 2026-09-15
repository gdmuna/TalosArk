import { UpdateUserInfoDto, UpdatePasswordDto } from '../user.dto.js';
import { UserRepository } from './user.repository.js';
import { EmailVerificationRepository } from './email-verification.repository.js';
import {
    UserNotFoundException,
    OldPasswordWrongException,
    EmailSameException,
    VerificationCodeInvalidException,
    VerificationCodeExpiredException,
    EmailAlreadyUsedException,
} from '../user.exception.js';

import { MailService } from '@/infra/mail/mail.service.js';
import { IdentityKernel } from '@/core/identity/index.js';

import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly emailVerificationRepository: EmailVerificationRepository,
        private readonly mailService: MailService,
        private readonly identityKernel: IdentityKernel
    ) {}

    async getMyInfo(userId: string) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new UserNotFoundException();
        const { passwordHash: _, ...safeUser } = user;
        return safeUser;
    }

    async updateInfo(userId: string, dto: UpdateUserInfoDto) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new UserNotFoundException();
        const updated = await this.userRepository.update(userId, {
            ...(dto.nickname !== undefined && { nickname: dto.nickname }),
            ...(dto.realname !== undefined && { realname: dto.realname }),
        });
        const { passwordHash: _, ...safeUser } = updated;
        return safeUser;
    }

    async updatePassword(userId: string, dto: UpdatePasswordDto) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new UserNotFoundException();
        const changed = await this.identityKernel.changePassword({
            userId,
            currentPassword: dto.oldPassword,
            newPassword: dto.newPassword,
        });
        if (!changed) throw new OldPasswordWrongException();
    }

    async searchUsers(keyword: string, currentUserId: string, limit: number) {
        return this.userRepository.search(keyword, currentUserId, limit);
    }

    // ── 邮箱相关（验证码链）──────────────────────

    async sendEmailCode(email: string) {
        const normalizedEmail = email.trim().toLowerCase();
        // 生成 6 位随机数字验证码
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟

        // 删除该邮箱的旧验证码（一次只允许一个有效码）
        await this.emailVerificationRepository.deleteByEmail(normalizedEmail);
        await this.emailVerificationRepository.create(normalizedEmail, code, expiresAt);
        await this.mailService.sendVerificationCode(normalizedEmail, code);

        return { sent: true };
    }

    async emailLogin(email: string, code: string) {
        const normalizedEmail = email.trim().toLowerCase();
        await this.verifyEmailCode(normalizedEmail, code);

        // 查找用户（邮箱登录不自动注册）
        const user = await this.userRepository.findByEmail(normalizedEmail);
        if (!user) throw new UserNotFoundException();

        // 验证通过后清除验证码
        await this.emailVerificationRepository.deleteByEmail(normalizedEmail);

        return this.identityKernel.createSessionForVerifiedUser({ userId: user.id });
    }

    /** 验证邮箱验证码，通过返回 void，失败抛出异常。 */
    private async verifyEmailCode(email: string, code: string): Promise<void> {
        const record = await this.emailVerificationRepository.findLatestByEmail(email);
        if (!record || record.code !== code) {
            throw new VerificationCodeInvalidException();
        }
        if (record.expiresAt < new Date()) {
            throw new VerificationCodeExpiredException();
        }
    }

    async updateEmail(userId: string, newEmail: string, code: string) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new UserNotFoundException();
        const normalizedEmail = newEmail.trim().toLowerCase();
        if (user.email === normalizedEmail) throw new EmailSameException();

        // 检查新邮箱是否已被其他账号使用
        const existing = await this.userRepository.findByEmail(normalizedEmail);
        if (existing && existing.id !== userId) throw new EmailAlreadyUsedException();

        await this.verifyEmailCode(normalizedEmail, code);
        await this.emailVerificationRepository.deleteByEmail(normalizedEmail);

        const updated = await this.userRepository.update(userId, { email: normalizedEmail });
        const { passwordHash: _, ...safeUser } = updated;
        return safeUser;
    }

    async emailUpdatePassword(email: string, code: string, newPassword: string) {
        const normalizedEmail = email.trim().toLowerCase();
        await this.verifyEmailCode(normalizedEmail, code);

        const user = await this.userRepository.findByEmail(normalizedEmail);
        if (!user) throw new UserNotFoundException();

        await this.identityKernel.resetPassword({ userId: user.id, newPassword });
        await this.emailVerificationRepository.deleteByEmail(normalizedEmail);
    }
}
