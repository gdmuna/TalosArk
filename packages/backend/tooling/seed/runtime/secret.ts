import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
    InvitationMail,
    InvitationMailDelivery,
} from '../../../src/modules/organization/application/invitation-delivery.port.js';

/** Never part of the reproducible plan, database receipts or normal output report. */
@Injectable()
export class SeedSecrets implements InvitationMailDelivery {
    private readonly accounts: {
        key: string;
        userId: string;
        username: string;
        email: string;
        password?: string;
        activationToken?: string;
    }[] = [];
    private readonly invitations = new Map<string, InvitationMail>();

    password(): string {
        return `Seed!${randomBytes(24).toString('base64url')}7a`;
    }

    account(value: (typeof this.accounts)[number]): void {
        this.accounts.push(value);
    }

    accountPassword(userId: string): string {
        const password = this.accounts.find((account) => account.userId === userId)?.password;
        if (!password) throw new Error('Local seed password is not available in this execution');
        return password;
    }

    replacePassword(userId: string, password: string): void {
        const account = this.accounts.find((account) => account.userId === userId);
        if (!account) throw new Error('Seed account is not owned by this execution');
        account.password = password;
    }

    enqueue(item: InvitationMail): boolean {
        this.invitations.set(item.id, item);
        return true;
    }

    invitation(id: string): string {
        const item = this.invitations.get(id);
        if (!item)
            throw new Error('Invitation was not delivered to the local seed inbox after commit');
        return item.token;
    }

    export() {
        return { accounts: this.accounts, invitations: [...this.invitations.values()] };
    }

    clear(): void {
        this.accounts.length = 0;
        this.invitations.clear();
    }
}
