import type { ApiErrorResponse, ApiResponseContext } from '@talos-ark/contracts/protocol';
import type { ErrorDefinition } from '@/platform/error/error.definition.js';
import { ErrorResolver, type ResolvedError } from '@/platform/error/error.resolver.js';
import { RequestErrorDefinition } from '@/platform/error/request.error-mapper.js';

export interface HttpErrorBinding {
    readonly definition: ErrorDefinition;
    readonly status: number;
}

export const RequestHttpError = {
    validation: { definition: RequestErrorDefinition.validation, status: 400 },
    authentication: { definition: RequestErrorDefinition.authentication, status: 401 },
    forbidden: { definition: RequestErrorDefinition.forbidden, status: 403 },
    notFound: { definition: RequestErrorDefinition.notFound, status: 404 },
    rateLimited: { definition: RequestErrorDefinition.rateLimited, status: 429 },
    payloadTooLarge: { definition: RequestErrorDefinition.payloadTooLarge, status: 413 },
    unsupportedContent: { definition: RequestErrorDefinition.unsupportedContent, status: 415 },
    processingTimeout: { definition: RequestErrorDefinition.processingTimeout, status: 504 },
    notImplemented: { definition: RequestErrorDefinition.notImplemented, status: 501 },
    invalid: { definition: RequestErrorDefinition.invalid, status: 400 },
    internal: { definition: RequestErrorDefinition.internal, status: 500 },
} as const satisfies Record<string, HttpErrorBinding>;

export class HttpErrorPolicy {
    private readonly bindings = new Map<ErrorDefinition, number>();

    constructor(
        bindings: readonly HttpErrorBinding[],
        private readonly resolver: ErrorResolver
    ) {
        const codes = new Set<string>();
        for (const binding of bindings) {
            const code = binding.definition.contract.code;
            if (
                !Number.isInteger(binding.status) ||
                binding.status < 400 ||
                binding.status > 599 ||
                codes.has(code)
            ) {
                throw new Error(`Invalid or duplicate HTTP error binding: ${code}`);
            }
            codes.add(code);
            this.bindings.set(binding.definition, binding.status);
        }
    }

    resolve(
        error: unknown,
        routeBindings?: ReadonlyMap<string, HttpErrorBinding>
    ): { error: ResolvedError; status: number } {
        const resolved = this.resolver.resolve(error);
        const binding = routeBindings?.get(resolved.public.code);
        const status = routeBindings
            ? binding?.definition === resolved.definition
                ? binding.status
                : undefined
            : this.bindings.get(resolved.definition);
        if (status !== undefined) return { error: resolved, status };
        return {
            error: this.resolver.internal(
                error,
                new Error(`Missing HTTP error binding: ${resolved.public.code}`)
            ),
            status: 500,
        };
    }
}

export function createHttpErrorResponse(
    error: ResolvedError,
    context: ApiResponseContext | null,
    errorReferenceUrl: string
): ApiErrorResponse {
    const docs = new URL(errorReferenceUrl);
    docs.hash = error.public.code.toLowerCase().replaceAll('_', '-');
    return {
        success: false,
        ...error.public,
        type: docs.href,
        timestamp: new Date().toISOString(),
        context,
    };
}
