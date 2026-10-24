import { z } from 'zod';
import { NulFreeTextSchema, UuidSchema } from '../protocol/scalar.js';
import { TeamNameSchema, CreateWorkspaceBodySchema } from './team.http.js';
import { TeamMemberSchema, TeamRoleSchema, TeamManagementSchema } from './team.management.js';

export const ManagementPageQuerySchema = z.strictObject({
    workspaceId: UuidSchema.toLowerCase().optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: NulFreeTextSchema.trim().max(100).default(''),
});
export const ManagementRoleQuerySchema = ManagementPageQuerySchema.extend({
    scope: z.enum(['ORGANIZATION', 'WORKSPACE']).optional(),
});
export const ManagementActivityQuerySchema = z.strictObject({
    workspaceId: UuidSchema.toLowerCase().optional(),
    cursor: z.string().min(1).max(1024).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
const organization = z.object({ id: UuidSchema, name: z.string() });
export const ManagementWorkspaceSchema = z.object({
    id: UuidSchema,
    organizationId: UuidSchema,
    name: z.string(),
    description: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().nullable(),
});
export const ManagementMemberSchema = TeamMemberSchema.extend({
    organizationId: UuidSchema,
    joinedAt: z.iso.datetime(),
    leftAt: z.iso.datetime().nullable(),
});
export const ManagementRoleSchema = TeamRoleSchema.extend({
    organizationId: UuidSchema,
    createdAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().nullable(),
});
export const WorkspaceDetailSchema = z.object({
    workspace: ManagementWorkspaceSchema,
    organization,
    canUpdate: z.boolean(),
    canViewMembers: z.boolean(),
    canReadActivity: z.boolean(),
    memberTotal: z.number().int().nonnegative().nullable(),
    members: z.array(ManagementMemberSchema).max(6),
    roleBindings: z.record(z.string(), z.number().int().nonnegative()),
});
export const WorkspaceUpdateSchema = CreateWorkspaceBodySchema.extend({
    name: TeamNameSchema,
    description: NulFreeTextSchema.trim().max(500),
    expectedUpdatedAt: z.iso.datetime({ precision: 3 }),
});
export const MemberDetailSchema = z.object({
    organization,
    member: ManagementMemberSchema,
    roles: z.array(ManagementRoleSchema),
    definitions: TeamManagementSchema.shape.definitions,
    canManageRoles: z.boolean(),
    canReadOrganizationRoles: z.boolean(),
    canReadActivity: z.boolean(),
});
export const MemberWorkspaceSchema = z.object({
    id: UuidSchema,
    organizationId: UuidSchema,
    workspaceId: UuidSchema,
    organizationMemberId: UuidSchema,
    status: TeamMemberSchema.shape.status,
    joinedAt: z.iso.datetime(),
    leftAt: z.iso.datetime().nullable(),
    workspace: ManagementWorkspaceSchema,
    roles: z.array(ManagementRoleSchema),
});
export const RoleDetailSchema = z.object({
    organization,
    role: ManagementRoleSchema,
    definitions: TeamManagementSchema.shape.definitions,
    canEdit: z.boolean(),
    canReadBindings: z.boolean(),
    canReadActivity: z.boolean(),
    bindingTotal: z.number().int().nonnegative().nullable(),
});
export const RoleBindingSchema = z.object({
    id: z.string(),
    member: ManagementMemberSchema,
    workspace: ManagementWorkspaceSchema.nullable(),
    createdAt: z.iso.datetime(),
});
function page<Schema extends z.ZodType>(item: Schema) {
    return z.object({
        items: z.array(item),
        total: z.number().int().nonnegative(),
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1).max(100),
    });
}
export const ManagementMemberPageSchema = page(ManagementMemberSchema);
export const ManagementRolePageSchema = page(ManagementRoleSchema);
export const MemberWorkspacePageSchema = page(MemberWorkspaceSchema);
export const RoleBindingPageSchema = page(RoleBindingSchema);
export const ManagementActivitySchema = z.object({
    id: UuidSchema,
    actorName: z.string(),
    action: z.string(),
    subjectName: z.string(),
    occurredAt: z.iso.datetime(),
});
export const ManagementActivityPageSchema = z.object({
    items: z.array(ManagementActivitySchema),
    nextCursor: z.string().nullable(),
});

export type ManagementPageQuery = z.infer<typeof ManagementPageQuerySchema>;
export type ManagementRoleQuery = z.infer<typeof ManagementRoleQuerySchema>;
export type ManagementActivityQuery = z.infer<typeof ManagementActivityQuerySchema>;
export type ManagementMember = z.infer<typeof ManagementMemberSchema>;
export type ManagementRole = z.infer<typeof ManagementRoleSchema>;
export type WorkspaceDetail = z.infer<typeof WorkspaceDetailSchema>;
export type WorkspaceUpdate = z.infer<typeof WorkspaceUpdateSchema>;
export type MemberDetail = z.infer<typeof MemberDetailSchema>;
export type MemberWorkspacePage = z.infer<typeof MemberWorkspacePageSchema>;
export type RoleDetail = z.infer<typeof RoleDetailSchema>;
export type RoleBindingPage = z.infer<typeof RoleBindingPageSchema>;
export type ManagementMemberPage = z.infer<typeof ManagementMemberPageSchema>;
export type ManagementRolePage = z.infer<typeof ManagementRolePageSchema>;
export type ManagementActivityPage = z.infer<typeof ManagementActivityPageSchema>;
