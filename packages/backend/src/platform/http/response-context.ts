import type { ApiResponseContext } from '@talos-ark/contracts/protocol';
import type { AlsExecutionContext } from '@/platform/context/als-context.adapter.js';

export function toApiResponseContext(
    context: AlsExecutionContext | undefined
): ApiResponseContext | null {
    if (!context) return null;
    return {
        requestId: context.requestId,
        time: context.time,
        version: context.version,
        userId: context.userId,
        metadata: context.metadata,
    };
}
