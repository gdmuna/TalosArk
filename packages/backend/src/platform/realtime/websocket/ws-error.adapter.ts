import {
    WsErrorMessageSchema,
    type ApiResponseContext,
    type WsErrorMessage,
} from '@talos-ark/contracts/protocol';
import { ErrorResolver, type ResolvedError } from '@/platform/error/error.resolver.js';

export class WsErrorAdapter {
    constructor(private readonly resolver: ErrorResolver) {}

    createResponse(
        error: unknown,
        context: ApiResponseContext | null,
        correlationId?: string
    ): { message: WsErrorMessage; error: ResolvedError } {
        const resolved = this.resolver.resolve(error);
        return {
            message: WsErrorMessageSchema.parse({
                kind: 'error',
                ...resolved.public,
                timestamp: new Date().toISOString(),
                context,
                correlationId,
            }),
            error: resolved,
        };
    }
}
