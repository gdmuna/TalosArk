import { IdentityErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/error.factory.js';

type IdentityFailureContext = {
    reason: keyof typeof IdentityErrorDefinition;
    operation?:
        | 'oidc.transaction.missing'
        | 'oidc.transaction.incomplete'
        | 'oidc.transaction.state-format-invalid'
        | 'oidc.transaction.state-mismatch';
};

export const IdentityError = defineErrorClass<
    typeof IdentityErrorDefinition,
    IdentityFailureContext
>(IdentityErrorDefinition, { name: 'IdentityError' });
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type IdentityError = InstanceType<typeof IdentityError>;
export type IdentityFailure = IdentityError['failure'];
