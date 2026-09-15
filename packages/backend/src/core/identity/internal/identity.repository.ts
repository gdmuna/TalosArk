import { DatabaseService } from '@/infra/database/database.service.js';

import { Injectable } from '@nestjs/common';

/** Local-account persistence owned by the identity kernel. */
@Injectable()
export class IdentityRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    findDuplicate(username: string, email: string) {
        return this.databaseService.user.findFirst({
            where: {
                OR: [{ username }, { email }],
            },
        });
    }

    findByAccount(account: string) {
        return this.databaseService.user.findFirst({
            where: {
                OR: [
                    { username: { equals: account, mode: 'insensitive' } },
                    { email: { equals: account, mode: 'insensitive' } },
                ],
            },
        });
    }

    findById(id: string) {
        return this.databaseService.user.findUnique({ where: { id } });
    }

    findByEmail(email: string) {
        return this.databaseService.user.findUnique({ where: { email } });
    }

    createPasswordAccount(data: { username: string; email: string; passwordHash: string }) {
        return this.databaseService.user.create({ data });
    }

    updatePasswordHash(userId: string, passwordHash: string) {
        return this.databaseService.user.update({
            where: { id: userId },
            data: { passwordHash },
        });
    }

    findByExternalIdentity(issuer: string, subject: string) {
        return this.databaseService.externalIdentity.findUnique({
            where: { issuer_subject: { issuer, subject } },
            include: { user: true },
        });
    }

    async createExternalAccount(data: {
        issuer: string;
        subject: string;
        username: string;
        email: string;
    }) {
        return this.databaseService.$transaction(async (transaction) => {
            const user = await transaction.user.create({
                data: {
                    username: data.username,
                    email: data.email,
                },
            });

            await transaction.externalIdentity.create({
                data: {
                    issuer: data.issuer,
                    subject: data.subject,
                    userId: user.id,
                },
            });

            return user;
        });
    }
}
