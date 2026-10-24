import { IdentityKernel } from '@/core/identity/index.js';

import { Injectable } from '@nestjs/common';
import { RequestError } from '@/platform/request/request.error.js';
import type { CurrentAccountResponse } from '@talos-ark/contracts/auth';

@Injectable()
export class UserService {
    constructor(private readonly identityKernel: IdentityKernel) {}

    async getMe(userId: string): Promise<CurrentAccountResponse> {
        const user = await this.identityKernel.getInternalUser({ type: 'normal', userId });
        if (!user) throw new RequestError({ reason: 'authentication' });
        const profile = user.profile;
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt.toISOString(),
            profile: profile
                ? {
                      nickname: profile.nickname,
                      avatarId: profile.avatarId,
                      bio: profile.bio,
                      sex: profile.sex,
                      sexVisible: profile.sexVisible,
                      birthday: profile.birthday?.toISOString() ?? null,
                  }
                : null,
        };
    }
}
