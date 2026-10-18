import { z } from 'zod';
import { NulFreeTextSchema, UuidSchema } from '../protocol/scalar.js';

export const TeamNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(40)
    // eslint-disable-next-line no-control-regex -- Names must be safe single-line database text.
    .regex(/^[^\u0000-\u001f\u007f-\u009f\ud800-\udfff]*$/u);
export const OrganizationSummarySchema = z.object({
    id: UuidSchema,
    name: z.string(),
    canCreateWorkspace: z.boolean(),
});
export const WorkspaceSummarySchema = z.object({
    id: UuidSchema,
    organizationId: UuidSchema,
    name: z.string(),
    description: z.string(),
});
export const CreateOrganizationBodySchema = z.strictObject({
    name: TeamNameSchema,
    workspaceName: TeamNameSchema,
});
export const CreateWorkspaceBodySchema = z.strictObject({
    name: TeamNameSchema,
    description: NulFreeTextSchema.trim().max(500).optional(),
});
export const OrganizationParamsSchema = z.strictObject({
    organizationId: UuidSchema.toLowerCase(),
});
export const WorkspaceContextParamsSchema = OrganizationParamsSchema.extend({
    workspaceId: UuidSchema.toLowerCase(),
});
export const TeamSnapshotResponseSchema = z.object({
    organizations: z.array(OrganizationSummarySchema),
    workspaces: z.array(WorkspaceSummarySchema),
});
export const CreateOrganizationResponseSchema = z.object({
    organization: OrganizationSummarySchema,
    workspace: WorkspaceSummarySchema,
});
export const OrganizationListResponseSchema = z.object({
    organizations: z.array(OrganizationSummarySchema),
});
export type CreateOrganizationBody = z.infer<typeof CreateOrganizationBodySchema>;
export type CreateWorkspaceBody = z.infer<typeof CreateWorkspaceBodySchema>;
export type OrganizationParams = z.infer<typeof OrganizationParamsSchema>;
export type WorkspaceContextParams = z.infer<typeof WorkspaceContextParamsSchema>;
export type TeamSnapshotResponse = z.infer<typeof TeamSnapshotResponseSchema>;
export type CreateOrganizationResponse = z.infer<typeof CreateOrganizationResponseSchema>;
export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>;
export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;
