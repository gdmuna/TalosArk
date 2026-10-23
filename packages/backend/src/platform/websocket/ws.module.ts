import { Module, type DynamicModule } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
import { WS_NAMESPACE } from '@talos-ark/contracts/protocol';
import { SessionModule } from '@/core/session/index.js';
import { PlatformContextModule } from '../context/context.module.js';
import { LoggerContributionModule } from '../observability/logger/logger.registry.js';
import { WS_OPTIONS, type WsModuleAsyncOptions } from './ws.contract.js';
import { WsRuntime } from './ws.runtime.js';
import { WsEmitter } from './ws.emitter.js';

/** Activates the authenticated namespace without inventing a business message. */
@WebSocketGateway({ namespace: WS_NAMESPACE })
class WsApplicationGateway {}

@Module({})
export class WsModule {
    static forRootAsync(options: WsModuleAsyncOptions): DynamicModule {
        return {
            module: WsModule,
            global: true,
            imports: [
                SessionModule,
                PlatformContextModule,
                LoggerContributionModule,
                ...(options.imports ?? []),
            ],
            providers: [
                { provide: WS_OPTIONS, inject: options.inject, useFactory: options.useFactory },
                WsRuntime,
                WsEmitter,
                WsApplicationGateway,
            ],
            exports: [WsEmitter, WsRuntime],
        };
    }
}
