import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';

@Injectable()
export class SystemAccessKernel {
    constructor(private readonly database: DatabaseRuntime) {}

    async isSuperAdmin(userId: string): Promise<boolean> {
        const user = await this.database.queryClient.user.findUnique({
            where: { id: userId },
            select: { isSuperAdmin: true },
        });
        return user?.isSuperAdmin === true;
    }
}
