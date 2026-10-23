import type { z } from 'zod';
import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import type { BrowserOriginPolicy } from '@/config/http.config.js';
import type { WebsocketConfig } from '@/config/websocket.config.js';
import type { WsRequestContract } from '@talos-ark/contracts/protocol';
import type { WsErrorAdapter } from './ws.error.adapter.js';

export interface WsModuleOptions extends WebsocketConfig {
    readonly browserOriginPolicy: BrowserOriginPolicy;
    readonly version: string;
    readonly errors: WsErrorAdapter;
}

export interface WsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    inject?: FactoryProvider<WsModuleOptions>['inject'];
    useFactory: (...dependencies: any[]) => WsModuleOptions | Promise<WsModuleOptions>;
}

export const WS_OPTIONS = Symbol('websocket.options');

export interface WsConnectionContext {
    readonly connectionId: string;
    readonly userId: string;
    readonly sessionId: string;
}

export interface WsMessageContext extends WsConnectionContext {
    readonly requestId: string;
    readonly correlationId: string;
    readonly signal: AbortSignal;
}

export interface WsBinding {
    readonly contract: WsRequestContract;
    readonly timeoutMs?: number;
    toString(): string;
}

/** Internal invocation frame, never serialized or exposed as a client payload. */
export class WsInvocation {
    failure?: { error: unknown };
    constructor(
        readonly payload: unknown,
        readonly context: WsMessageContext
    ) {}
}

export type WsPayloadOf<C extends WsRequestContract> = z.output<C['payload']>;
export type WsResultOf<C extends WsRequestContract> = z.output<C['result']>;
