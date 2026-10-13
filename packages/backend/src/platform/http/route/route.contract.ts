import { z } from 'zod';
import {
    createApiErrorResponseSchema,
    createApiSuccessResponseSchema,
    type ErrorDefinition,
} from '@talos-ark/contracts/protocol';
import {
    AccessErrorDefinition,
    RequestErrorDefinition,
    SystemErrorDefinition,
} from '@talos-ark/contracts/backend';
import type { HttpErrorBinding } from '../error/http.error.policy.js';

export const AUTH_STRATEGY_KEY = 'auth:strategy';
export type AUTH_STRATEGY_TYPE = 'public' | 'optional' | 'required';
export const ROUTE_CONTRACT_KEY = 'route:contract';
export const REQUEST_ROUTE_CONTRACT = Symbol('request:route-contract');

export interface ApiRouteRequest {
    body?: z.ZodType;
    query?: z.ZodObject;
    params?: z.ZodObject;
    headers?: z.ZodObject;
}

export type ApiRouteResponse =
    | { status: number; schema: z.ZodType; description?: string }
    | { status: 204 | 205; schema?: never; description?: string };

export interface ApiRouteOptions {
    auth: AUTH_STRATEGY_TYPE;
    summary: string;
    description?: string;
    request?: ApiRouteRequest;
    /** The first response supplies the default status; [] declares an error-only route. */
    responses: readonly ApiRouteResponse[];
    errors?: readonly ErrorDefinition[];
    consumes?: readonly string[];
    deprecated?: boolean;
    /** Documentation only; execution still follows auth and owner-local credential checks. */
    security?: readonly Record<string, string[]>[];
}

export interface RouteResponseContract {
    readonly status: number;
    readonly schema?: z.ZodType;
    readonly description: string;
}

export interface RouteContract {
    readonly auth: AUTH_STRATEGY_TYPE;
    readonly request: ApiRouteRequest;
    readonly defaultStatus?: number;
    readonly responses: ReadonlyMap<number, RouteResponseContract>;
    readonly errors: ReadonlyMap<string, HttpErrorBinding>;
}

declare module 'fastify' {
    interface FastifyRequest {
        [REQUEST_ROUTE_CONTRACT]?: RouteContract;
    }
}

const COMMON_ERRORS = [
    RequestErrorDefinition.validation,
    RequestErrorDefinition.invalid,
    RequestErrorDefinition.forbidden,
    RequestErrorDefinition.rateLimited,
    RequestErrorDefinition.payloadTooLarge,
    RequestErrorDefinition.unsupportedContent,
    RequestErrorDefinition.processingTimeout,
    SystemErrorDefinition.internal,
];

export function errorResponseSchema(definition: ErrorDefinition) {
    if (!definition.public) throw new TypeError(`Error is not public: ${definition.id}`);
    return createApiErrorResponseSchema(definition.public);
}

export function compileRouteContract(options: ApiRouteOptions): RouteContract {
    const auth = options.auth;
    if (!['public', 'optional', 'required'].includes(auth)) {
        throw new Error(`Invalid route authentication strategy: ${auth}`);
    }
    const request = { ...options.request };
    const errors = new Map<string, HttpErrorBinding>();
    const bindings = [
        ...COMMON_ERRORS,
        ...(auth === 'required' ? [RequestErrorDefinition.authentication] : []),
        ...(auth !== 'public' ? [AccessErrorDefinition['session-unavailable']] : []),
        ...(options.errors ?? []),
    ];
    const schemas = new Map<number, z.ZodType[]>();
    const descriptions = new Map<number, string[]>();
    const append = (status: number, schema: z.ZodType | undefined, description: string) => {
        const alternatives = schemas.get(status) ?? [];
        if (schema) alternatives.push(schema);
        schemas.set(status, alternatives);
        descriptions.set(status, [...(descriptions.get(status) ?? []), description]);
    };

    for (const response of options.responses) {
        const { status, schema, description } = response;
        const empty = status === 204 || status === 205;
        if (
            !Number.isInteger(status) ||
            status < 200 ||
            status > 299 ||
            (empty ? schema !== undefined : schema === undefined)
        ) {
            throw new Error(`Invalid route success response: ${status}`);
        }
        append(
            status,
            schema && createApiSuccessResponseSchema(schema),
            description ?? (empty ? 'Operation succeeded without content' : 'Operation succeeded')
        );
    }
    const codes = new Map<string, string>();
    for (const definition of bindings) {
        if (!definition.public) throw new TypeError(`Error is not public: ${definition.id}`);
        const code = definition.public.code;
        const binding: HttpErrorBinding = {
            definition,
            status: definition.protocol?.http?.status ?? 500,
        };
        const previous = errors.get(definition.id);
        if (
            !Number.isInteger(binding.status) ||
            binding.status < 400 ||
            binding.status > 599 ||
            (codes.has(code) && codes.get(code) !== definition.id) ||
            (previous &&
                (previous.definition.public?.code !== code ||
                    previous.definition.public?.details !== definition.public.details ||
                    previous.definition.public?.message !== definition.public.message ||
                    previous.status !== binding.status))
        ) {
            throw new Error(`Invalid or conflicting route error: ${code}`);
        }
        if (previous) continue;
        codes.set(code, definition.id);
        errors.set(definition.id, binding);
        append(binding.status, errorResponseSchema(definition), definition.public.message);
    }

    const responses = new Map<number, RouteResponseContract>();
    for (const [status, alternatives] of schemas) {
        responses.set(status, {
            status,
            schema: alternatives.length > 1 ? z.union(alternatives) : alternatives[0],
            description: [...new Set(descriptions.get(status))].join(' / '),
        });
    }
    return { auth, request, defaultStatus: options.responses[0]?.status, responses, errors };
}
