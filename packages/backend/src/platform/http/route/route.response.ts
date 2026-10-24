import { z } from 'zod';
import { defineErrorClass, defineInternalErrorCatalog } from '@/platform/error/index.js';

type RouteResponseFailure = {
    reason: 'undeclared-status' | 'body-not-allowed' | 'invalid-body';
    status: number;
};
const catalog = defineInternalErrorCatalog('route-response', [
    'undeclared-status',
    'body-not-allowed',
    'invalid-body',
]);
export const RouteResponseError = defineErrorClass<typeof catalog, RouteResponseFailure>(catalog, {
    name: 'RouteResponseError',
    diagnosticMessage: (failure) =>
        ({
            'undeclared-status': 'Response status is not declared by the route contract',
            'body-not-allowed': 'This response status does not allow a response body',
            'invalid-body': 'Response body does not match the route contract',
        })[failure.reason],
});

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
