import type { MailMessage } from '@/infra/mail/mail.contract.js';

export function passwordRecoveryMail(email: string, url: string, ttlSeconds: number): MailMessage {
    const minutes = Math.ceil(ttlSeconds / 60);
    return {
        to: email,
        subject: '璇玑云库：重设密码',
        text: [
            '我们收到了重设璇玑云库账户密码的申请。',
            `请在 ${minutes} 分钟内打开下方链接设置新密码：`,
            url,
            '链接仅可使用一次，重新申请后旧链接会失效。',
            '如果不是你本人申请，请忽略这封邮件；账户密码和登录状态尚未改变。',
        ].join('\n\n'),
    };
}
