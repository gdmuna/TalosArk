import { z } from 'zod';
import { CreateWorkspaceBodySchema, TeamRoleBodySchema } from '@talos-ark/contracts/team';
import type { SeederKind } from '../seed.definition.js';
import { scopeReferenceSchema } from './seed.kind.js';
import { accountsKind } from './account.kind.js';

const key = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
export const extraWorkspaceKind = {
    id: 'workspace-layout',
    data: CreateWorkspaceBodySchema,
    input: scopeReferenceSchema,
    output: scopeReferenceSchema,
} satisfies SeederKind;

export const teamKind = {
    id: 'team',
    data: z
        .strictObject({
            roles: z
                .array(
                    z.strictObject({
                        key,
                        input: TeamRoleBodySchema,
                        archived: z.boolean().default(false),
                    })
                )
                .max(32),
            members: z
                .array(
                    z.strictObject({
                        account: key,
                        workspace: z.boolean().default(true),
                        roles: z.array(key).default([]),
                        lifecycle: z.enum(['active', 'left', 'rejoined']).default('active'),
                    })
                )
                .max(200),
            invitations: z
                .array(
                    z.strictObject({
                        key,
                        account: key,
                        workspace: z.boolean().default(false),
                        state: z.enum(['pending', 'revoked', 'resent']),
                    })
                )
                .max(32),
            checks: z
                .array(
                    z.strictObject({
                        account: key,
                        permissionCode: z.string(),
                        allowed: z.boolean(),
                    })
                )
                .default([]),
        })
        .superRefine((value, context) => {
            const roles = new Set(value.roles.map((role) => role.key));
            if (
                roles.size !== value.roles.length ||
                new Set(value.members.map((member) => member.account)).size !==
                    value.members.length ||
                new Set(value.invitations.map((item) => item.key)).size !== value.invitations.length
            )
                context.addIssue({ code: 'custom', message: 'Duplicate governance fixture key' });
            for (const member of value.members)
                for (const role of member.roles)
                    if (!roles.has(role))
                        context.addIssue({ code: 'custom', message: `Unknown role ${role}` });
        }),
    input: z.strictObject({ scope: scopeReferenceSchema, accounts: accountsKind.output }),
    output: z.strictObject({
        scope: scopeReferenceSchema,
        roles: z.record(z.string(), z.uuid()),
        members: z.record(z.string(), z.uuid()),
        invitations: z.record(z.string(), z.uuid()),
    }),
} satisfies SeederKind;

export const workspaceMembershipKind = {
    id: 'workspace-membership',
    data: z.strictObject({
        members: z
            .array(
                z.strictObject({
                    account: key,
                    roles: z.array(key).default([]),
                    leave: z.boolean().default(false),
                })
            )
            .max(200),
    }),
    input: z.strictObject({
        scope: scopeReferenceSchema,
        team: teamKind.output,
        accounts: accountsKind.output,
    }),
    output: z.record(z.string(), z.uuid()),
} satisfies SeederKind;
