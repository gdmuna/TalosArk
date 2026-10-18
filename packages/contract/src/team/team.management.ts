import { z } from 'zod';
import { NulFreeTextSchema, UuidSchema } from '../protocol/scalar.js';
import { OrganizationParamsSchema, TeamNameSchema } from './team.http.js';

export const TeamScopeQuerySchema = z.strictObject({
    workspaceId: UuidSchema.toLowerCase().optional(),
});
export const TeamManagementQuerySchema = TeamScopeQuerySchema.extend({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: NulFreeTextSchema.trim().max(100).default(''),
});
export const TeamItemParamsSchema = OrganizationParamsSchema.extend({
    id: UuidSchema.toLowerCase(),
});
export const TeamRoleSchema = z.object({
    id: UuidSchema,
    code: z.string(),
    name: z.string(),
    scope: z.enum(['ORGANIZATION', 'WORKSPACE']),
    permissions: z.array(z.string()),
    protected: z.boolean(),
    grantable: z.boolean(),
    updatedAt: z.iso.datetime(),
});
export const TeamMemberSchema = z.object({
    id: UuidSchema,
    organizationMemberId: UuidSchema,
    userId: UuidSchema,
    name: z.string(),
    email: z.string(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'LEFT']),
    isOwner: z.boolean(),
    roles: z.array(z.object({ id: UuidSchema, name: z.string() })),
});
export const TeamInvitationSchema = z.object({
    id: UuidSchema,
    email: z.string(),
    workspaceId: UuidSchema.nullable(),
    workspaceName: z.string().nullable(),
    expiresAt: z.iso.datetime(),
    status: z.enum(['pending', 'expired', 'accepted', 'revoked']),
});
export const TeamManagementSchema = z.object({
    organizationId: UuidSchema,
    workspaceId: UuidSchema.nullable(),
    isOwner: z.boolean(),
    initialized: z.boolean(),
    canInitialize: z.boolean(),
    canManageMembers: z.boolean(),
    canManageRoles: z.boolean(),
    canInvite: z.boolean(),
    members: z.array(TeamMemberSchema),
    memberTotal: z.number().int().nonnegative(),
    invitations: z.array(TeamInvitationSchema),
    invitationTotal: z.number().int().nonnegative(),
    roles: z.array(TeamRoleSchema),
    definitions: z.array(
        z.object({
            code: z.string(),
            name: z.string(),
            scope: z.enum(['ORGANIZATION', 'WORKSPACE']),
        })
    ),
    page: z.number().int(),
    pageSize: z.number().int(),
});
export const TeamRoleBodySchema = z.strictObject({
    code: z
        .string()
        .max(120)
        .regex(/^[a-z][a-z0-9-]*$/),
    name: TeamNameSchema,
    scope: z.enum(['ORGANIZATION', 'WORKSPACE']),
    permissions: z.array(z.string().max(120)).max(256),
});
export const TeamRoleUpdateSchema = TeamRoleBodySchema.pick({
    name: true,
    permissions: true,
}).extend({
    expectedUpdatedAt: z.iso.datetime({ precision: 3 }),
});
export const TeamBindingBodySchema = z.strictObject({
    roleIds: z.array(UuidSchema.toLowerCase()).max(32),
});
export const TeamEmailBodySchema = z.strictObject({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});
export const InvitationTokenBodySchema = z.strictObject({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const InvitationPreviewSchema = z.object({
    organizationName: z.string(),
    workspaceName: z.string().nullable(),
    email: z.string(),
    expiresAt: z.iso.datetime(),
});
export const InvitationAcceptedSchema = z.object({
    organizationId: UuidSchema,
    workspaceId: UuidSchema.nullable(),
});
export const InvitationDeliverySchema = z.object({ delivery: z.enum(['queued', 'unavailable']) });

export type TeamScopeQuery = z.infer<typeof TeamScopeQuerySchema>;
export type TeamManagementQuery = z.infer<typeof TeamManagementQuerySchema>;
export type TeamManagement = z.infer<typeof TeamManagementSchema>;
export type TeamRole = z.infer<typeof TeamRoleSchema>;
export type TeamRoleBody = z.infer<typeof TeamRoleBodySchema>;
export type TeamRoleUpdate = z.infer<typeof TeamRoleUpdateSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamInvitation = z.infer<typeof TeamInvitationSchema>;
export type TeamItemParams = z.infer<typeof TeamItemParamsSchema>;
