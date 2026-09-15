import { DatabaseService } from '@/infra/database/database.service.js';

import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository {
    constructor(private readonly db: DatabaseService) {}

    async findById(id: string) {
        return this.db.user.findUnique({ where: { id } });
    }

    async findByEmail(email: string) {
        return this.db.user.findUnique({ where: { email } });
    }

    async update(id: string, data: Partial<{ nickname: string; realname: string; email: string }>) {
        return this.db.user.update({ where: { id }, data });
    }

    async search(keyword: string, excludeUserId: string, limit: number) {
        return this.db.user.findMany({
            where: {
                id: { not: excludeUserId },
                OR: [
                    { username: { contains: keyword, mode: 'insensitive' } },
                    { email: { contains: keyword, mode: 'insensitive' } },
                    { nickname: { contains: keyword, mode: 'insensitive' } },
                ],
            },
            take: limit,
            select: { id: true, username: true, nickname: true, email: true },
        });
    }
}
