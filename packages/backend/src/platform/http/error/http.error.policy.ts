import type {
    ApiErrorResponse,
    ApiResponseContext,
    ErrorDefinition,
} from '@talos-ark/contracts/protocol';
import { ErrorResolver, type ResolvedError } from '@/platform/error/error.resolver.js';
import { definedErrorId, type DefinedError } from '@/platform/error/error.factory.js';

export interface HttpErrorBinding {
    readonly definition: ErrorDefinition;
    readonly status: number;
}

export class HttpErrorPolicy {
    constructor(private readonly resolver: ErrorResolver) {}

    resolve(
        error: unknown,
        routeBindings?: ReadonlyMap<string, HttpErrorBinding>
    ): { error: ResolvedError; status: number; retryAfterSeconds?: number } {
        const resolved = this.resolver.resolve(error);
        const binding = routeBindings?.get(resolved.definition.id);
        const status = routeBindings
            ? binding?.definition.public?.code === resolved.public.code
                ? binding.status
                : undefined
            : (resolved.definition.protocol?.http?.status ?? 500);
        if (status !== undefined) {
            const retryAfterSeconds =
                definedErrorId(resolved.original) === resolved.definition.id
                    ? ((resolved.original as DefinedError).retryAfterSeconds ??
                      resolved.definition.protocol?.http?.retryAfterSeconds)
                    : undefined;
            return {
                error: resolved,
                status,
                ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
            };
        }
        return {
            error: this.resolver.internal(
                error,
                new Error(`Undeclared route error: ${resolved.definition.id}`)
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
