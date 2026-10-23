import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module.js';
import { IdentityCredential } from './internal/identity.credential.js';
import { IdentityPasswordHasher } from './internal/password.hasher.js';

/** Local credentials do not require an external identity provider or session store. */
@Module({
    imports: [DatabaseModule],
    providers: [IdentityCredential, IdentityPasswordHasher],
    exports: [IdentityCredential],
})
export class IdentityCredentialModule {}
