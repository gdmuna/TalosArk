import { IdentityKernel } from '@/core/identity/index.js';

import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
    constructor(private readonly identityKernel: IdentityKernel) {}

    oidcStart() {
        return this.identityKernel.createOidcTransaction();
    }

    resolveOidcLoginCallback(dto: { code: string; state: string; id: string }) {
        return this.identityKernel.resolveOidcLoginCallback(dto);
    }
}
