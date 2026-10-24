import {
    ApiResponseContextSchema,
    WsErrorMessageSchema,
    createWsErrorMessageSchema,
    type ApiResponseContext,
    type WsErrorMessage,
} from '@talos-ark/contracts/protocol';
import { ErrorResolver, type ResolvedError } from '@/platform/error/error.resolver.js';
import { definedErrorId, type DefinedError } from '@/platform/error/error.factory.js';

/** Shared error projection for Socket.IO handshakes, ACKs and control events. */
export class WsErrorAdapter {
    constructor(private readonly resolver: ErrorResolver) {}

    createResponse(
        error: unknown,
        context: ApiResponseContext | null,
        correlationId?: string
    ): { message: WsErrorMessage; error: ResolvedError; closeCode?: number } {
        let resolved = this.resolver.resolve(error);
        const matched = definedErrorId(error) === resolved.definition.id;
        const protocol = resolved.definition.protocol?.ws;
        try {
            const schema = createWsErrorMessageSchema(resolved.definition.public);
            const parsed = schema.parse({
                kind: 'error',
                ...resolved.public,
                timestamp: new Date().toISOString(),
                context,
                correlationId,
                retryAfterMs: matched
                    ? ((error as DefinedError).retryAfterMs ?? protocol?.retryAfterMs)
                    : undefined,
            });
            return {
                message: WsErrorMessageSchema.parse(
                    schema.parse(JSON.parse(JSON.stringify(parsed)))
                ),
                error: resolved,
                closeCode: protocol?.closeCode,
            };
        } catch (resolutionError) {
            resolved = this.resolver.internal(error, resolutionError);
        }
        const safeContext = ApiResponseContextSchema.safeParse(context);
        return {
            message: WsErrorMessageSchema.parse({
                kind: 'error',
                ...resolved.public,
                timestamp: new Date().toISOString(),
                context: safeContext.success ? safeContext.data : null,
                correlationId:
                    typeof correlationId === 'string' && correlationId.length > 0
                        ? correlationId
                        : undefined,
            }),
            error: resolved,
        };
    }
}
