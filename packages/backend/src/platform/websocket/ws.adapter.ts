import type { INestApplicationContext } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { MessageMappingProperties } from '@nestjs/websockets';
import {
    GATEWAY_METADATA,
    GATEWAY_OPTIONS,
    MESSAGE_MAPPING_METADATA,
    MESSAGE_METADATA,
    PORT_METADATA,
    PARAM_ARGS_METADATA,
} from '@nestjs/websockets/constants.js';
import { WsParamtype } from '@nestjs/websockets/enums/ws-paramtype.enum.js';
import { firstValueFrom, type Observable } from 'rxjs';
import { Server, type ServerOptions, type Socket } from 'socket.io';
import { WS_NAMESPACE, WS_PATH } from '@talos-ark/contracts/protocol';
import { isAllowedBrowserOrigin } from '../http/browser-origin.policy.js';
import { toApiResponseContext } from '../context/response-context.js';
import { AlsContextAdapter } from '../context/als-context.adapter.js';
import { RequestError, validationIssues } from '../request/request.error.js';
import { assertWsJson } from './ws.json.js';
import { WsInvocation, type WsBinding } from './ws.contract.js';
import { WsRuntime } from './ws.runtime.js';
import { recordWsRejection } from './ws.telemetry.js';

/** Nest owns handler discovery and execution; this adapter owns transport admission and ACKs. */
export class WsAdapter extends IoAdapter {
    private readonly bound = new WeakMap<Socket, Set<string>>();
    private server?: Server;
    private readonly als: AlsContextAdapter;

    constructor(
        app: INestApplicationContext,
        private readonly runtime: WsRuntime
    ) {
        super(app);
        this.als = app.get(AlsContextAdapter);
        // Validation only, not another runtime handler registry or contribution mechanism.
        const scanner = new MetadataScanner();
        const events = new Set<string>();
        for (const module of app.get(ModulesContainer).values()) {
            for (const provider of module.providers.values()) {
                if (
                    provider.isAlias ||
                    !provider.metatype ||
                    !Reflect.getMetadata(GATEWAY_METADATA, provider.metatype)
                )
                    continue;
                if (!provider.isDependencyTreeStatic() || provider.scope)
                    throw new TypeError('WebSocket gateways must be static singletons');
                const options = Reflect.getMetadata(GATEWAY_OPTIONS, provider.metatype);
                if (
                    options?.namespace !== WS_NAMESPACE ||
                    Reflect.getMetadata(PORT_METADATA, provider.metatype) !== 0
                )
                    throw new TypeError(
                        `WebSocket gateways must use port 0 and namespace ${WS_NAMESPACE}`
                    );
                const instance = provider.instance as Record<string, (...args: never[]) => unknown>;
                for (const method of scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
                    const callback = instance[method];
                    if (!Reflect.getMetadata(MESSAGE_MAPPING_METADATA, callback)) continue;
                    const binding = Reflect.getMetadata(MESSAGE_METADATA, callback) as WsBinding;
                    if (binding?.contract?.kind !== 'request')
                        throw new TypeError('Use @WsMessage for application WebSocket handlers');
                    const parameters = Reflect.getMetadata(
                        PARAM_ARGS_METADATA,
                        instance.constructor,
                        method
                    );
                    if (
                        Object.keys(parameters ?? {}).some((key) =>
                            key.startsWith(`${WsParamtype.ACK}:`)
                        )
                    )
                        throw new TypeError(
                            'WsMessage owns the ACK; do not declare an @Ack parameter'
                        );
                    if (events.has(binding.contract.event))
                        throw new TypeError(`Duplicate WebSocket event: ${binding.contract.event}`);
                    events.add(binding.contract.event);
                }
            }
        }
    }

    override createIOServer(port: number, options?: Partial<ServerOptions>): Server {
        if (port !== 0 || this.server)
            throw new TypeError('Use one WebSocket server on the existing HTTP listener');
        const limits = this.runtime.options;
        const allowedOrigin = (origin: unknown) =>
            origin === undefined || isAllowedBrowserOrigin(origin, limits.browserOriginPolicy);
        const server: Server = super.createIOServer(port, {
            ...options,
            path: WS_PATH,
            transports: ['polling', 'websocket'],
            maxHttpBufferSize: limits.maxPayloadBytes,
            connectTimeout: limits.handshakeTimeoutMs,
            perMessageDeflate: false,
            connectionStateRecovery: undefined,
            cors: {
                origin: (origin, done) => done(null, allowedOrigin(origin)),
                credentials: false,
            },
            allowRequest: (request, done) => {
                if (!allowedOrigin(request.headers.origin)) {
                    recordWsRejection('origin');
                    done('Origin is not allowed', false);
                } else
                    done(
                        null,
                        !this.runtime.isStopping &&
                            (this.server?.engine.clientsCount ?? 0) < limits.maxConnections
                    );
            },
        } satisfies Partial<ServerOptions>);
        this.server = server;
        this.runtime.attach(server);
        return server;
    }

    override bindMessageHandlers(
        socket: Socket,
        handlers: MessageMappingProperties[],
        transform: (data: unknown) => Observable<unknown>
    ): void {
        let events = this.bound.get(socket);
        if (!events) {
            events = new Set();
            this.bound.set(socket, events);
            const registered = events;
            socket.use((packet, next) => {
                if (!this.runtime.admitMessage(socket)) return;
                if (registered.has(packet[0])) {
                    next();
                    return;
                }
                recordWsRejection('protocol');
                const reply = packet.at(-1);
                const error = this.runtime.failure(new RequestError({ reason: 'notFound' }));
                this.runtime.reply(
                    socket,
                    error,
                    typeof reply === 'function' ? (message) => reply(message) : undefined
                );
            });
        }
        for (const { message, callback, isAckHandledManually } of handlers) {
            const binding = message as WsBinding;
            if (
                binding?.contract?.kind !== 'request' ||
                isAckHandledManually ||
                events.has(binding.contract.event)
            )
                throw new TypeError('Use unique @WsMessage handlers without manual ACK parameters');
            const { contract } = binding;
            events.add(contract.event);
            socket.on(contract.event, (...args: unknown[]) => {
                const ack = args[1];
                if (args.length !== 2 || typeof ack !== 'function') {
                    recordWsRejection('protocol');
                    this.runtime.reply(
                        socket,
                        this.runtime.failure(new RequestError({ reason: 'invalid' }))
                    );
                    return;
                }
                this.runtime.handle(
                    socket,
                    contract.event,
                    args[0],
                    (response) => ack(response),
                    async (payload, context) => {
                        const parsed = await contract.payload.safeParseAsync(payload);
                        if (!parsed.success)
                            throw new RequestError({
                                reason: 'validation',
                                details: { issues: validationIssues(parsed.error) },
                            });
                        if (context.signal.aborted)
                            throw new RequestError({ reason: 'processingTimeout' });
                        const invocation = new WsInvocation(parsed.data, context);
                        const result = await firstValueFrom(transform(callback(invocation)), {
                            defaultValue: undefined,
                        });
                        if (invocation.failure) throw invocation.failure.error;
                        // Validate both the owner result and the exact JSON sent over the wire.
                        const response = await contract.ack.parseAsync({
                            kind: 'success',
                            correlationId: context.correlationId,
                            data: result,
                            timestamp: new Date().toISOString(),
                            context: toApiResponseContext(this.als.get()),
                        });
                        assertWsJson(response, this.runtime.options.maxPayloadBytes);
                        const wire: unknown = JSON.parse(JSON.stringify(response));
                        await contract.ack.parseAsync(wire);
                        return wire;
                    },
                    binding.timeoutMs
                );
            });
        }
    }

    override async dispose(): Promise<void> {
        await this.runtime.stop();
        await super.dispose();
    }
}
