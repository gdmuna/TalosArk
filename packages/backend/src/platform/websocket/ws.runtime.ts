import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Namespace, Server, Socket } from 'socket.io';
import { ulid } from 'ulid';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
    WS_ERROR_EVENT,
    WS_NAMESPACE,
    WsHandshakeSchema,
    WsRequestMessageSchema,
    type ApiResponseContext,
    type WsErrorMessage,
} from '@talos-ark/contracts/protocol';
import { SessionKernel } from '@/core/session/index.js';
import { AlsContextAdapter } from '../context/als-context.adapter.js';
import { RequestError, validationIssues } from '../request/request.error.js';
import { createErrorDiagnostic } from '../error/error.diagnostic.js';
import { LoggerContributions } from '../observability/logger/logger.registry.js';
import { assertWsJson } from './ws.json.js';
import {
    WS_OPTIONS,
    type WsConnectionContext,
    type WsMessageContext,
    type WsModuleOptions,
} from './ws.contract.js';
import {
    observeWsOperation,
    observeWsHandshake,
    recordWsActive,
    recordWsConnections,
    recordWsHandshakes,
    recordWsLifetime,
    recordWsPending,
    recordWsRejection,
    recordWsTimeout,
} from './ws.telemetry.js';

interface Connection {
    socket: Socket;
    token: string;
    context: Readonly<WsConnectionContext>;
    expiresAt: number;
    startedAt: number;
    expiry?: NodeJS.Timeout;
    tail: Promise<void>;
    pending: number;
    controllers: Set<AbortController>;
    tokens: number;
    refillAt: number;
    bufferedPackets: number;
}

export type WsTarget = { connectionId: string } | { userId: string } | { room: string };

@Injectable()
export class WsRuntime {
    private readonly connections = new Map<string, Connection>();
    private readonly tasks = new Set<Promise<void>>();
    private namespace?: Namespace;
    private server?: Server;
    private pendingHandshakes = 0;
    private pending = 0;
    private active = 0;
    private stopping = false;
    private stopped?: Promise<void>;

    get isStopping(): boolean {
        return this.stopping;
    }

    constructor(
        @Inject(WS_OPTIONS) readonly options: WsModuleOptions,
        private readonly sessions: SessionKernel,
        private readonly als: AlsContextAdapter,
        private readonly contributions: LoggerContributions,
        @InjectPinoLogger(WsRuntime.name) private readonly logger: PinoLogger
    ) {
        this.options = Object.freeze({ ...options });
    }

    attach(server: Server): void {
        if (this.namespace) throw new Error('WebSocket server already attached');
        this.server = server;
        server
            .of('/')
            .use((_socket, next) =>
                next(this.connectionError(new RequestError({ reason: 'notFound' })))
            );
        this.namespace = server.of(WS_NAMESPACE);
        this.namespace.use((socket, next) => this.open(socket, next));
    }

    private open(socket: Socket, next: (error?: Error) => void): void {
        if (
            this.stopping ||
            this.pendingHandshakes >= this.options.maxPendingHandshakes ||
            this.connections.size + this.pendingHandshakes >= this.options.maxConnections
        ) {
            recordWsRejection('capacity');
            next(this.connectionError(new RequestError({ reason: 'rateLimited' })));
            return;
        }
        this.pendingHandshakes++;
        recordWsHandshakes(1);
        let finished = false;
        const finish = (error?: unknown) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (error !== undefined)
                recordWsRejection(
                    RequestError.is(error, 'authentication')
                        ? 'authentication'
                        : RequestError.is(error, 'rateLimited')
                          ? 'capacity'
                          : RequestError.is(error, 'processingTimeout')
                            ? 'timeout'
                            : 'error'
                );
            next(error === undefined ? undefined : this.connectionError(error));
        };
        const timer = setTimeout(() => {
            recordWsTimeout('handshake');
            finish(new RequestError({ reason: 'processingTimeout' }));
        }, this.options.handshakeTimeoutMs);
        timer.unref();
        const task = (async () => {
            try {
                const parsed = WsHandshakeSchema.safeParse(socket.handshake.auth);
                socket.handshake.auth = {};
                if (!parsed.success) throw new RequestError({ reason: 'authentication' });
                const claim = await observeWsHandshake(() =>
                    this.sessions.verifyAccessToken(parsed.data)
                );
                if (!claim || claim.exp * 1000 <= Date.now())
                    throw new RequestError({ reason: 'authentication' });
                if (finished) return;
                if (this.stopping || socket.conn.readyState !== 'open')
                    throw new RequestError({ reason: 'invalid' });
                let userConnections = 0;
                for (const connection of this.connections.values())
                    if (connection.context.userId === claim.sub) userConnections++;
                if (userConnections >= this.options.maxConnectionsPerUser)
                    throw new RequestError({ reason: 'rateLimited' });
                const connection: Connection = {
                    socket,
                    token: parsed.data.accessToken,
                    context: Object.freeze({
                        connectionId: socket.id,
                        userId: claim.sub,
                        sessionId: claim.sid,
                    }),
                    expiresAt: claim.exp * 1000,
                    startedAt: performance.now(),
                    tail: Promise.resolve(),
                    pending: 0,
                    controllers: new Set(),
                    tokens: this.options.messagesPerSecond,
                    refillAt: performance.now(),
                    bufferedPackets: 0,
                };
                this.connections.set(socket.id, connection);
                recordWsConnections(1);
                const remove = () => this.remove(connection);
                socket.once('disconnect', remove);
                socket.conn.once('close', remove);
                // Public Engine.IO events track queued packets without reading its private buffer.
                socket.conn.on('packetCreate', () => {
                    connection.bufferedPackets++;
                });
                socket.conn.on('drain', () => {
                    connection.bufferedPackets = 0;
                });
                this.armExpiry(connection);
                finish();
            } catch (error) {
                finish(error);
            } finally {
                this.pendingHandshakes--;
                recordWsHandshakes(-1);
            }
        })();
        this.track(task);
    }

    private armExpiry(connection: Connection): void {
        connection.expiry = setTimeout(
            () => {
                if (connection.expiresAt > Date.now()) this.armExpiry(connection);
                else this.disconnect(connection, new RequestError({ reason: 'authentication' }));
            },
            Math.min(Math.max(connection.expiresAt - Date.now(), 1), 2_147_483_647)
        );
        connection.expiry.unref();
    }

    private remove(connection: Connection): void {
        if (!this.connections.delete(connection.socket.id)) return;
        clearTimeout(connection.expiry);
        for (const controller of connection.controllers) controller.abort();
        connection.token = '';
        recordWsConnections(-1);
        recordWsLifetime((performance.now() - connection.startedAt) / 1000);
    }

    private disconnect(connection: Connection, error?: unknown): void {
        if (error !== undefined && connection.socket.connected)
            connection.socket.emit(WS_ERROR_EVENT, this.failure(error));
        connection.socket.disconnect(true);
        this.remove(connection);
    }

    private connectionError(error: unknown): Error & { data: WsErrorMessage } {
        return Object.assign(new Error('WebSocket connection rejected'), {
            data: this.failure(error),
        });
    }

    failure(
        error: unknown,
        correlationId?: string,
        context: ApiResponseContext | null = null
    ): WsErrorMessage {
        let resolved = this.options.errors.createResponse(error, context, correlationId);
        try {
            assertWsJson(resolved.message, this.options.maxPayloadBytes);
        } catch (cause) {
            resolved = this.options.errors.createResponse(
                new Error('WebSocket error response exceeds the wire budget', { cause }),
                context,
                correlationId
            );
        }
        const diagnostic = createErrorDiagnostic(resolved.error, this.contributions.project);
        this.logger[diagnostic.level](
            { ...diagnostic.data, requestId: context?.requestId },
            diagnostic.message
        );
        return resolved.message;
    }

    admitMessage(socket: Socket): boolean {
        const connection = this.connections.get(socket.id);
        if (!connection || this.stopping) return false;
        if (connection.expiresAt <= Date.now()) {
            this.disconnect(connection, new RequestError({ reason: 'authentication' }));
            return false;
        }
        const now = performance.now();
        connection.tokens = Math.min(
            this.options.messagesPerSecond,
            connection.tokens +
                ((now - connection.refillAt) * this.options.messagesPerSecond) / 1000
        );
        connection.refillAt = now;
        if (connection.tokens < 1) {
            recordWsRejection('capacity');
            this.disconnect(connection, new RequestError({ reason: 'rateLimited' }));
            return false;
        }
        connection.tokens--;
        return true;
    }

    private async verify(connection: Connection): Promise<void> {
        const claim = await this.sessions.verifyAccessToken({ accessToken: connection.token });
        if (
            !claim ||
            claim.sub !== connection.context.userId ||
            claim.sid !== connection.context.sessionId ||
            connection.expiresAt <= Date.now()
        ) {
            this.disconnect(connection, new RequestError({ reason: 'authentication' }));
            throw new RequestError({ reason: 'authentication' });
        }
    }

    handle(
        socket: Socket,
        event: string,
        raw: unknown,
        reply: (value: unknown) => void,
        work: (payload: unknown, context: WsMessageContext) => Promise<unknown>,
        timeoutMs?: number
    ): void {
        const connection = this.connections.get(socket.id);
        if (!connection) return;
        const parsed = WsRequestMessageSchema.safeParse(raw);
        this.submit(
            connection,
            event,
            parsed.success ? parsed.data.correlationId : undefined,
            async (context) => {
                await this.verify(connection);
                if (context.signal.aborted) throw new RequestError({ reason: 'processingTimeout' });
                try {
                    assertWsJson(raw, this.options.maxPayloadBytes);
                } catch (cause) {
                    throw new RequestError({ reason: 'payloadTooLarge' }, { cause });
                }
                if (!parsed.success)
                    throw new RequestError({
                        reason: 'validation',
                        details: { issues: validationIssues(parsed.error) },
                    });
                return work(parsed.data.payload, context);
            },
            (result, error, context) => {
                this.reply(
                    socket,
                    error === undefined
                        ? result
                        : this.failure(
                              error,
                              parsed.success ? parsed.data.correlationId : undefined,
                              context
                          ),
                    reply
                );
            },
            timeoutMs
        );
    }

    reply(socket: Socket, message: unknown, ack?: (message: unknown) => void): void {
        const connection = this.connections.get(socket.id);
        if (!connection || !socket.connected) return;
        if (connection.bufferedPackets >= this.options.maxPendingMessagesPerConnection) {
            recordWsRejection('backpressure');
            this.disconnect(connection, new RequestError({ reason: 'rateLimited' }));
            return;
        }
        if (ack) ack(message);
        else socket.emit(WS_ERROR_EVENT, message);
    }

    private submit<T>(
        connection: Connection,
        event: string,
        correlationId: string | undefined,
        work: (context: WsMessageContext) => Promise<T>,
        respond: (
            result: T | undefined,
            error: unknown | undefined,
            context: ApiResponseContext
        ) => void,
        timeoutMs = this.options.messageTimeoutMs,
        serialized = true
    ): void {
        const requestId = ulid();
        const controller = new AbortController();
        const context = Object.freeze({
            ...connection.context,
            requestId,
            correlationId: correlationId ?? requestId,
            signal: controller.signal,
        });
        const responseContext: ApiResponseContext = {
            requestId,
            time: Date.now(),
            userId: connection.context.userId,
            version: this.options.version,
        };
        let responded = false;
        let report = respond;
        if (
            this.stopping ||
            !connection.socket.connected ||
            this.pending >= this.options.maxPendingMessages ||
            connection.pending >= this.options.maxPendingMessagesPerConnection
        ) {
            recordWsRejection('capacity');
            respond(undefined, new RequestError({ reason: 'rateLimited' }), responseContext);
            return;
        }
        const finish = (result?: T, error?: unknown) => {
            if (responded) return;
            responded = true;
            clearTimeout(timer);
            report(result, error, responseContext);
        };
        this.pending++;
        connection.pending++;
        recordWsPending(1);
        connection.controllers.add(controller);
        const timer = setTimeout(
            () => {
                recordWsTimeout('message');
                controller.abort();
                finish(undefined, new RequestError({ reason: 'processingTimeout' }));
            },
            Math.min(timeoutMs, this.options.messageTimeoutMs)
        );
        timer.unref();
        const task = (serialized ? connection.tail : Promise.resolve())
            .then(async () => {
                if (controller.signal.aborted || this.stopping || !connection.socket.connected) {
                    finish(undefined, new RequestError({ reason: 'processingTimeout' }));
                    return;
                }
                if (this.active >= this.options.maxActiveMessages) {
                    recordWsRejection('capacity');
                    finish(undefined, new RequestError({ reason: 'rateLimited' }));
                    return;
                }
                this.active++;
                recordWsActive(1);
                try {
                    const result = await this.als.run(
                        {
                            requestId,
                            time: responseContext.time,
                            userId: context.userId,
                            version: this.options.version,
                        },
                        () =>
                            observeWsOperation(event, async () => {
                                report = AsyncLocalStorage.bind(respond);
                                const value = await work(context);
                                if (controller.signal.aborted)
                                    throw new RequestError({ reason: 'processingTimeout' });
                                return value;
                            })
                    );
                    finish(result);
                } catch (error) {
                    if (responded && !RequestError.is(error, 'processingTimeout'))
                        this.failure(error, correlationId, responseContext);
                    finish(
                        undefined,
                        error ?? new Error('WebSocket handler failed without an error')
                    );
                } finally {
                    this.active--;
                    recordWsActive(-1);
                }
            })
            .finally(() => {
                clearTimeout(timer);
                connection.controllers.delete(controller);
                connection.pending--;
                this.pending--;
                recordWsPending(-1);
            });
        // Timeout answers the caller, but execution capacity remains occupied until actual settlement.
        const settled = task.catch((error: unknown) => {
            this.failure(error);
        });
        if (serialized) connection.tail = settled;
        this.track(settled);
    }

    recipients(target: WsTarget): readonly Connection[] {
        return [...this.connections.values()].filter(({ socket, context }) =>
            'connectionId' in target
                ? socket.id === target.connectionId
                : 'userId' in target
                  ? context.userId === target.userId
                  : socket.rooms.has(this.roomName(target.room))
        );
    }

    deliver(
        connection: Connection,
        event: string,
        payload: unknown,
        authorize: (recipient: WsConnectionContext, signal: AbortSignal) => Promise<boolean>
    ): Promise<boolean> {
        return new Promise((resolve) =>
            this.submit(
                connection,
                event,
                undefined,
                async (context) => {
                    await this.verify(connection);
                    if (
                        context.signal.aborted ||
                        !(await authorize(connection.context, context.signal))
                    )
                        return false;
                    if (
                        context.signal.aborted ||
                        !connection.socket.connected ||
                        connection.expiresAt <= Date.now()
                    )
                        return false;
                    if (!connection.socket.conn.transport.writable) {
                        recordWsRejection('backpressure');
                        return false;
                    }
                    connection.socket.volatile.emit(event, payload);
                    return true;
                },
                (sent, error) => {
                    if (error !== undefined) this.failure(error);
                    resolve(error === undefined && sent === true);
                },
                this.options.messageTimeoutMs,
                false
            )
        );
    }

    async join(connectionId: string, room: string): Promise<void> {
        const connection = this.connections.get(connectionId);
        if (!connection || this.stopping) throw new RequestError({ reason: 'authentication' });
        await this.verify(connection);
        if (!connection.socket.connected) throw new RequestError({ reason: 'authentication' });
        await connection.socket.join(this.roomName(room));
    }

    async leave(connectionId: string, room: string): Promise<void> {
        await this.connections.get(connectionId)?.socket.leave(this.roomName(room));
    }

    private roomName(room: string): string {
        if (!/^[a-zA-Z0-9_.:-]{1,160}$/.test(room))
            throw new TypeError('Invalid WebSocket room name');
        return `app:${room}`;
    }

    private track(task: Promise<void>): void {
        this.tasks.add(task);
        void task.then(
            () => this.tasks.delete(task),
            () => this.tasks.delete(task)
        );
    }

    stop(): Promise<void> {
        if (this.stopped) return this.stopped;
        this.stopping = true;
        for (const connection of this.connections.values()) this.disconnect(connection);
        // Includes transports which have not authenticated a namespace yet.
        this.server?.engine.close();
        this.stopped = Promise.all([...this.tasks]).then(() => undefined);
        return this.stopped;
    }
}
