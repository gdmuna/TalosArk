import {
    ApiBody,
    ApiParam,
    ApiQuery,
    ApiHeader,
    ApiResponse,
    type SchemaObject,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { ApiRouteRequest, RouteContract } from './route.contract.js';

function openApiSchema(schema: z.ZodType, io: 'input' | 'output'): SchemaObject {
    return z.toJSONSchema(schema, { target: 'openapi-3.0', io }) as SchemaObject;
}

export function routeRequestDocumentation(request: ApiRouteRequest) {
    const decorators = [];
    if (request.body)
        decorators.push(
            ApiBody({
                schema: openApiSchema(request.body, 'input'),
                required: !request.body.isOptional(),
            })
        );
    for (const source of ['query', 'params', 'headers'] as const) {
        const schema = request[source];
        if (!schema) continue;
        const json = openApiSchema(schema, 'input');
        for (const [name, property] of Object.entries(json.properties ?? {})) {
            const options = {
                name,
                schema: property,
                required: source === 'params' || (json.required?.includes(name) ?? false),
            };
            decorators.push(
                source === 'params'
                    ? ApiParam(options)
                    : source === 'headers'
                      ? ApiHeader(options)
                      : ApiQuery(options)
            );
        }
    }
    return decorators;
}

export function routeResponseDocumentation(contract: RouteContract) {
    return [...contract.responses.values()].map(({ status, schema, description }) =>
        ApiResponse({
            status,
            description,
            ...(schema
                ? { content: { 'application/json': { schema: openApiSchema(schema, 'output') } } }
                : {}),
        })
    );
}
