import { PrismaService } from '@/infra/database/prisma/prisma.service.js';

import { Prisma } from '@root/prisma/generated/client.js';

import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityAccessRepo {
    constructor(private readonly prismaService: PrismaService) {}

    getSession(id: string, db: Prisma.TransactionClient = this.prismaService) {
        return db.session.findUnique({ where: { id } });
    }

    // getSession(id: string, db: Prisma.TransactionClient = this.prismaService) {
    //     return db.user.findUnique({ where: { id } });
    // }

    // getOrCreateSession(id: string, db: Prisma.TransactionClient = this.prismaService) {
    //     return db.user.upsert({
    //         where: {

    //         },
    //         create: {

    //         },
    //         update: {},
    //     })
    // }

    // getUserAndSessionCount(userId: string) {
    //     return Promise.all([
    //         this.getUser(userId),
    //         this.prismaService.session.count({ where: { userId } }),
    //     ]);
    // }

    // getUserAndSessionCountInTransaction(userId: string) {
    //     return this.prismaService.$transaction([
    //         this.getUser(userId),
    //         this.prismaService.session.count({ where: { userId } }),
    //     ]);
    // }

    // getUserWithSessionsInTransaction(userId: string) {
    //     return this.prismaService.$transaction(async (tx) => {
    //         const user = await this.getUser(userId, tx);
    //         if (!user) return null;

    //         const sessions = await tx.session.findMany({ where: { userId } });
    //         return { user, sessions };
    //     });
    // }
}
