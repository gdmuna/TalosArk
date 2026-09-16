import { AllConfig } from '@/config/index.js';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
    private transporter!: Transporter;

    constructor(private readonly configService: ConfigService<AllConfig, true>) {}

    onModuleInit() {
        const cfg = this.configService.get('mail', { infer: true });
        this.transporter = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: {
                user: cfg.user,
                pass: cfg.pass,
            },
        });
    }

    /**
     * 发送纯文本/HTML 邮件。
     *
     * @param to 收件人地址。
     * @param subject 主题。
     * @param text 纯文本正文（可选，html 优先）。
     * @param html HTML 正文（可选）。
     */
    async sendMail(params: {
        to: string;
        subject: string;
        text?: string;
        html?: string;
    }): Promise<void> {
        const cfg = this.configService.get('mail', { infer: true });
        await this.transporter.sendMail({
            from: cfg.from,
            to: params.to,
            subject: params.subject,
            text: params.text,
            html: params.html,
        });
    }
}
