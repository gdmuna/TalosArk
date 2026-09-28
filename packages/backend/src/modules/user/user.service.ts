import { IdentityKernel } from '@/core/identity/index.js';

import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
    constructor(private readonly identityKernel: IdentityKernel) {}

    async getUser() {}

    async getMe() {}
}
