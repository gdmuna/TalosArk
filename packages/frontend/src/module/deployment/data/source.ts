import { z } from 'zod';

const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
export const deploymentInformationSchema = z.object({
    organizationId: z.string().min(1),
    measuredAt: timestamp,
    version: z.string().nullable(),
    builtAt: timestamp.nullable(),
    environmentLabel: z.string().nullable(),
});
export type DeploymentInformation = z.infer<typeof deploymentInformationSchema>;
export interface DeploymentInformationDataSource {
    read(organizationId: string, signal: AbortSignal): Promise<DeploymentInformation>;
}
