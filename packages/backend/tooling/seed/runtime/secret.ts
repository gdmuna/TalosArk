import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import {
    closeSync,
    fsyncSync,
    lstatSync,
    mkdirSync,
    openSync,
    readFileSync,
    renameSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import type {
    InvitationMail,
    InvitationMailDelivery,
} from '../../../src/modules/organization/application/invitation-delivery.port.js';

const accountSchema = z.strictObject({
    key: z.string(),
    username: z.string(),
    email: z.string(),
    userId: z.uuid().optional(),
    password: z.string().optional(),
    activationToken: z.string().optional(),
    status: z.enum(['prepared', 'committed']),
    pendingPassword: z.object({ key: z.string(), password: z.string() }).optional(),
});
const fileSchema = z.strictObject({
    formatVersion: z.literal(1),
    namespace: z.string(),
    planHash: z.string(),
    accounts: z.array(accountSchema),
    invitations: z.array(
        z.object({
            id: z.string(),
            email: z.string(),
            token: z.string(),
            organizationName: z.string(),
        })
    ),
});
type Account = z.output<typeof accountSchema>;

/** Plaintext development-tool output, never part of a plan or database receipt. */
@Injectable()
export class SeedSecrets implements InvitationMailDelivery {
    private readonly accounts = new Map<string, Account>();
    private readonly invitations = new Map<string, InvitationMail>();
    private path?: string;
    private batch?: { namespace: string; planHash: string };
    private writeError?: Error;

    open(path: string, batch: { namespace: string; planHash: string }, resume: boolean): void {
        this.path = resolve(path);
        this.batch = batch;
        if (resume) {
            const stat = lstatSync(this.path);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 ** 2)
                throw new Error('Credentials input must be a bounded regular file');
            const saved = fileSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
            if (saved.namespace !== batch.namespace || saved.planHash !== batch.planHash)
                throw new Error('Credentials file belongs to another seed batch or plan');
            for (const account of saved.accounts) {
                if (this.accounts.has(account.key))
                    throw new Error('Duplicate account in credentials file');
                this.accounts.set(account.key, account);
            }
            for (const invitation of saved.invitations)
                this.invitations.set(invitation.id, invitation);
        } else {
            mkdirSync(dirname(this.path), { recursive: true });
            closeSync(openSync(this.path, 'wx', 0o600));
        }
        if (!resume) this.save();
        else closeSync(openSync(this.path, 'r+'));
    }

    password(): string {
        return `Seed!${randomBytes(24).toString('base64url')}7a`;
    }

    prepareAccount(
        key: string,
        identity: { username: string; email: string },
        active: boolean
    ): Account {
        const previous = this.accounts.get(key);
        if (previous) {
            if (
                previous.username !== identity.username ||
                previous.email !== identity.email ||
                (active && !previous.password)
            )
                throw new Error('Saved account credentials do not match the planned account');
            return previous;
        }
        const account: Account = {
            key,
            ...identity,
            status: 'prepared',
            ...(active ? { password: this.password() } : {}),
        };
        this.accounts.set(key, account);
        this.save();
        return account;
    }

    captureAccount(key: string, userId: string, activationToken?: string): void {
        const account = this.accounts.get(key);
        if (!account) throw new Error('Seed account credentials were not prepared');
        account.userId = userId;
        account.activationToken = activationToken;
        this.save();
    }

    confirmAccount(key: string, userId: string): void {
        const account = this.accountFor(key, userId);
        if (account.status !== 'committed') {
            account.status = 'committed';
            this.save();
        }
    }

    accountFor(key: string, userId: string): Account {
        const account = this.accounts.get(key);
        if (!account || account.userId !== userId)
            throw new Error(
                'Committed account credentials are missing; passwords cannot be recovered from receipts'
            );
        return account;
    }

    accountPassword(userId: string): string {
        const password = [...this.accounts.values()].find(
            (account) => account.userId === userId
        )?.password;
        if (!password) throw new Error('Local seed password is unavailable; no password was reset');
        return password;
    }

    preparePasswordChange(userId: string, key: string): string {
        const account = [...this.accounts.values()].find((account) => account.userId === userId);
        if (!account) throw new Error('Seed account is not owned by this execution');
        if (account.pendingPassword && account.pendingPassword.key !== key)
            throw new Error('An earlier password change requires inspection');
        account.pendingPassword ??= { key, password: this.password() };
        this.save();
        return account.pendingPassword.password;
    }

    confirmPasswordChange(userId: string): void {
        const account = [...this.accounts.values()].find((account) => account.userId === userId);
        if (!account?.pendingPassword) throw new Error('No prepared password change exists');
        account.password = account.pendingPassword.password;
        delete account.pendingPassword;
        this.save();
    }

    enqueue(item: InvitationMail): boolean {
        this.invitations.set(item.id, item);
        try {
            this.save();
            return true;
        } catch {
            return false;
        }
    }

    invitation(id: string): string {
        this.assertHealthy();
        const item = this.invitations.get(id);
        if (!item) throw new Error('Invitation token is unavailable in the saved seed inbox');
        return item.token;
    }

    get error(): Error | undefined {
        return this.writeError;
    }
    assertHealthy(): void {
        if (this.writeError) throw this.writeError;
    }

    private save(): void {
        if (!this.path || !this.batch)
            throw new Error('An explicit credentials output file is required');
        const temporary = join(dirname(this.path), `.${basename(this.path)}.${randomUUID()}.tmp`);
        try {
            // Tiny tool-owned files are synchronously flushed before the next business write.
            // Atomic replacement preserves the previous valid JSON if preparation fails.
            const fd = openSync(temporary, 'wx', 0o600);
            try {
                writeFileSync(
                    fd,
                    `${JSON.stringify(
                        {
                            formatVersion: 1,
                            ...this.batch,
                            accounts: [...this.accounts.values()],
                            invitations: [...this.invitations.values()],
                        },
                        null,
                        2
                    )}\n`
                );
                fsyncSync(fd);
            } finally {
                closeSync(fd);
            }
            renameSync(temporary, this.path);
        } catch {
            this.writeError = new Error(
                'Credentials file could not be saved; committed database records are retained'
            );
            throw this.writeError;
        } finally {
            try {
                unlinkSync(temporary);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                    this.writeError ??= new Error(
                        'Unable to remove a private credentials temporary file'
                    );
            }
        }
    }

    clear(): void {
        this.accounts.clear();
        this.invitations.clear();
        this.path = undefined;
        this.batch = undefined;
    }
}
