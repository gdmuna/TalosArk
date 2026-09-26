import { PrismaService } from '@/infra/database/prisma/prisma.service.js';

import { Prisma } from '@root/prisma/generated/client.js';
import { UserCreateInput } from '@root/prisma/generated/models.js';

import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityRepository {
    constructor(private readonly prismaService: PrismaService) {}

    getUser(id: string, db: Prisma.TransactionClient = this.prismaService) {
        return db.user.findUnique({ where: { id } });
    }

    createUser(data: UserCreateInput, db: Prisma.TransactionClient = this.prismaService) {
        return db.user.create({
            data,
        });
    }

    getExternalIdentity(
        input: {
            issuer: string;
            subject: string;
        },
        db: Prisma.TransactionClient = this.prismaService
    ) {
        return db.externalIdentity.findUnique({
            where: {
                issuer_subject: {
                    ...input,
                },
            },
        });
    }

    createExternalIdentity(
        data: {
            issuer: string;
            subject: string;
            userId: string;
        },
        db: Prisma.TransactionClient = this.prismaService
    ) {
        return db.externalIdentity.create({
            data,
        });
    }

    $transaction() {
        return this.prismaService.$transaction;
    }
}
