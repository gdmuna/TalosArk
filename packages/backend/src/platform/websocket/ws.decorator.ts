import {
    applyDecorators,
    createParamDecorator,
    UseFilters,
    type ExecutionContext,
} from '@nestjs/common';
import { SubscribeMessage } from '@nestjs/websockets';
import { isObservable } from 'rxjs';
import type { WsRequestContract } from '@talos-ark/contracts/protocol';
import { WsInvocation, type WsBinding } from './ws.contract.js';
import { WsExceptionFilter } from './ws.exception.filter.js';

export function WsMessage(
    contract: WsRequestContract,
    options: { timeoutMs?: number } = {}
): MethodDecorator {
    if (
        options.timeoutMs !== undefined &&
        (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1)
    )
        throw new TypeError('Invalid WebSocket message timeout');
    const binding: WsBinding = Object.freeze({
        contract,
        ...options,
        toString: () => contract.event,
    });
    return (target, key, descriptor) => {
        const original = descriptor.value as (...args: unknown[]) => unknown;
        const wrapped = async function (this: unknown, ...args: unknown[]) {
            const result = await original.apply(this, args);
            if (isObservable(result))
                throw new TypeError('WsMessage requires one result, not an Observable stream');
            return result;
        };
        for (const metadata of Reflect.getOwnMetadataKeys(original))
            Reflect.defineMetadata(metadata, Reflect.getOwnMetadata(metadata, original), wrapped);
        descriptor.value = wrapped as typeof descriptor.value;
        applyDecorators(SubscribeMessage(binding), UseFilters(new WsExceptionFilter()))(
            target,
            key,
            descriptor
        );
    };
}

function invocation(context: ExecutionContext): WsInvocation {
    const frame = context.switchToWs().getData<unknown>();
    if (!(frame instanceof WsInvocation)) throw new TypeError('WsMessage adapter is required');
    return frame;
}

export const WsPayload = createParamDecorator(
    (_: unknown, context: ExecutionContext) => invocation(context).payload
);
export const WsContext = createParamDecorator(
    (_: unknown, context: ExecutionContext) => invocation(context).context
);
