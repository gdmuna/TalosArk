import { z } from 'zod';

export const ApiResponseContextSchema = z.object({
    requestId: z.string().min(1),
    time: z.int().nonnegative().describe('Request start time in Unix milliseconds'),
    version: z.string().optional(),
    userId: z.string().optional(),
});

export type ApiResponseContext = z.infer<typeof ApiResponseContextSchema>;
