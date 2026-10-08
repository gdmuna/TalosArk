import { z } from 'zod';

export class RouteResponseError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'RouteResponseError';
    }
}

function jsonResponse(value: unknown): unknown {
    // Validate the wire representation: optional undefined fields are omitted by JSON.
    return JSON.parse(JSON.stringify(value));
}

export function parseJsonResponse(schema: z.ZodType, value: unknown): unknown {
    const body = jsonResponse(schema.parse(value));
    schema.parse(body);
    return body;
}

export async function parseJsonResponseAsync(schema: z.ZodType, value: unknown): Promise<unknown> {
    const body = jsonResponse(await schema.parseAsync(value));
    await schema.parseAsync(body);
    return body;
}
