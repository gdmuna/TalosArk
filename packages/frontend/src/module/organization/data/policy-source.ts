import { z } from 'zod';

const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const fact = z.object({
    origin: z.enum(['organization', 'deployment-default', 'unknown']),
    impact: z.string().nullable(),
});
export const organizationPolicySchema = z.object({
    organizationId: z.string().min(1),
    measuredAt: timestamp,
    updatedAt: timestamp.nullable(),
    archiveRetention: fact.extend({ days: z.number().int().positive().nullable() }),
    auditExport: fact.extend({
        mode: z.enum(['administrator', 'roles', 'unavailable', 'unknown']),
        roleNames: z.array(z.string().min(1)),
    }),
    invitationValidity: fact.extend({ days: z.number().int().positive().nullable() }),
    timeZone: fact.extend({
        value: z
            .string()
            .refine((value) => {
                try {
                    new Intl.DateTimeFormat('zh-CN', { timeZone: value });
                    return !!value;
                } catch {
                    return false;
                }
            })
            .nullable(),
    }),
});
export type OrganizationPolicy = z.infer<typeof organizationPolicySchema>;
export interface OrganizationPolicyDataSource {
    read(organizationId: string, signal: AbortSignal): Promise<OrganizationPolicy>;
}
