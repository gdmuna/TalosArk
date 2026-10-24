import { defineSeedRuntime, provideSeedHandler } from '../../runtime/contribution.js';
import { IdentityCredentialModule } from '../../../../src/core/identity/identity-credential.module.js';
import { AccountSeeder } from './account.seeder.js';
import { CredentialSeeder } from './credential.seeder.js';
import { accountsKind } from './account.kind.js';
import { credentialKind } from './credential.kind.js';
export const identityRuntime = defineSeedRuntime({
    imports: [IdentityCredentialModule],
    providers: [],
    handlers: [
        provideSeedHandler(accountsKind, AccountSeeder),
        provideSeedHandler(credentialKind, CredentialSeeder),
    ],
});
