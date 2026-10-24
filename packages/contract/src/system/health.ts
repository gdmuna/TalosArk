import { z } from 'zod';

export const LivenessResponseSchema = z.object({ status: z.literal('alive') });
export const ReadinessResponseSchema = z.object({
    status: z.literal('ready'),
    scope: z.literal('process'),
});

export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
