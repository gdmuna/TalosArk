import { z } from 'zod';
import { ApiResponseContextSchema } from './context.js';
import { PublicErrorSchema, type ErrorContract } from './error.js';
import { UtcDateTimeSchema } from './scalar.js';

export const WsCorrelationIdSchema = z.string().min(1).max(128);

export const WsErrorMessageSchema = PublicErrorSchema.extend({
    kind: z.literal('error'),
    correlationId: WsCorrelationIdSchema.optional(),
    timestamp: UtcDateTimeSchema,
    context: ApiResponseContextSchema.nullable(),
    retryAfterMs: z.number().nonnegative().optional(),
});

export function createWsErrorMessageSchema<S extends z.ZodType, const C extends string>(
    contract: ErrorContract<S, C>
) {
    return WsErrorMessageSchema.extend({
        code: z.literal(contract.code),
        message: z.literal(contract.message),
        details: contract.details,
    });
}

export type WsErrorMessage = z.infer<typeof WsErrorMessageSchema>;

export const WS_NAMESPACE = '/app';
export const WS_PATH = '/socket.io';
export const WS_ERROR_EVENT = 'ws.error';

export const WsHandshakeSchema = z.strictObject({ accessToken: z.string().min(1).max(8192) });
export const WsRequestMessageSchema = z.strictObject({
    correlationId: WsCorrelationIdSchema,
    payload: z.unknown(),
});

export const WsSuccessMessageSchema = z.object({
    kind: z.literal('success'),
    correlationId: WsCorrelationIdSchema,
    data: z.unknown(),
    timestamp: UtcDateTimeSchema,
    context: ApiResponseContextSchema.nullable(),
});

export function createWsAckSchema<S extends z.ZodType>(result: S) {
    return z.discriminatedUnion('kind', [
        WsSuccessMessageSchema.extend({ data: result }),
        WsErrorMessageSchema,
    ]);
}

export interface WsRequestContract<
    Name extends string = string,
    Payload extends z.ZodType = z.ZodType,
    Result extends z.ZodType = z.ZodType,
> {
    readonly kind: 'request';
    readonly event: Name;
    readonly payload: Payload;
    readonly result: Result;
    readonly request: ReturnType<typeof WsRequestMessageSchema.extend<{ payload: Payload }>>;
    readonly ack: ReturnType<typeof createWsAckSchema<Result>>;
}

export interface WsEventContract<
    Name extends string = string,
    Payload extends z.ZodType = z.ZodType,
> {
    readonly kind: 'event';
    readonly event: Name;
    readonly payload: Payload;
}

function validateEventName(event: string): void {
    // Excludes Socket.IO lifecycle names and reserves ws.* for platform control messages.
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/.test(event) || event.startsWith('ws.'))
        throw new TypeError(`Invalid application WebSocket event name: ${event}`);
}

export function defineWsRequest<
    const Name extends string,
    Payload extends z.ZodType,
    Result extends z.ZodType,
>(definition: {
    event: Name;
    payload: Payload;
    result: Result;
}): WsRequestContract<Name, Payload, Result> {
    validateEventName(definition.event);
    return Object.freeze({
        ...definition,
        kind: 'request',
        request: WsRequestMessageSchema.extend({ payload: definition.payload }),
        ack: createWsAckSchema(definition.result),
    });
}

export function defineWsEvent<const Name extends string, Payload extends z.ZodType>(definition: {
    event: Name;
    payload: Payload;
}): WsEventContract<Name, Payload> {
    validateEventName(definition.event);
    return Object.freeze({ ...definition, kind: 'event' });
}

export type WsAck<T = unknown> =
    (Omit<z.infer<typeof WsSuccessMessageSchema>, 'data'> & { data: T }) | WsErrorMessage;

/** Pass a union of domain-owned definitions; no Socket.IO runtime dependency is needed. */
export type WsClientToServerEvents<C extends WsRequestContract> = {
    [D in C as D['event']]: (
        message: { correlationId: string; payload: z.input<D['payload']> },
        ack: (response: WsAck<z.output<D['result']>>) => void
    ) => void;
};

export type WsServerToClientEvents<C extends WsEventContract = never> = {
    [D in C as D['event']]: (payload: z.output<D['payload']>) => void;
} & { [WS_ERROR_EVENT]: (error: WsErrorMessage) => void };
