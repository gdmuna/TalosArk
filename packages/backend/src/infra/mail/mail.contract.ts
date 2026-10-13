export interface MailMessage {
    /** One mailbox or a list of mailboxes. Display names are allowed, recipient groups are not. */
    to: string | readonly string[];
    subject: string;
    text?: string;
    html?: string;
}

export interface MailSendOptions {
    signal?: AbortSignal;
}

export interface MailSendResult {
    /** SMTP acceptance is not proof of inbox delivery. */
    status: 'accepted' | 'partial';
    messageId: string;
    accepted: readonly string[];
    rejected: readonly string[];
}
