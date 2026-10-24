import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { parseEnvironment } from './internal/config.validation.js';

export const websocketConfigSchema = z
    .object({
        WS_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(100_000).default(1000),
        WS_MAX_CONNECTIONS_PER_USER: z.coerce.number().int().min(1).max(100).default(8),
        WS_MAX_PENDING_HANDSHAKES: z.coerce.number().int().min(1).max(1000).default(32),
        WS_MAX_ACTIVE_MESSAGES: z.coerce.number().int().min(1).max(1000).default(32),
        WS_MAX_PENDING_MESSAGES: z.coerce.number().int().min(1).max(100_000).default(1024),
        WS_MAX_PENDING_MESSAGES_PER_CONNECTION: z.coerce
            .number()
            .int()
            .min(1)
            .max(1000)
            .default(16),
        WS_MAX_PAYLOAD_BYTES: z.coerce.number().int().min(1024).max(1_048_576).default(65_536),
        WS_MESSAGES_PER_SECOND: z.coerce.number().int().min(1).max(1000).default(30),
        WS_HANDSHAKE_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5000),
        WS_MESSAGE_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(10_000),
    })
    .transform((env) => ({
        maxConnections: env.WS_MAX_CONNECTIONS,
        maxConnectionsPerUser: env.WS_MAX_CONNECTIONS_PER_USER,
        maxPendingHandshakes: env.WS_MAX_PENDING_HANDSHAKES,
        maxActiveMessages: env.WS_MAX_ACTIVE_MESSAGES,
        maxPendingMessages: env.WS_MAX_PENDING_MESSAGES,
        maxPendingMessagesPerConnection: env.WS_MAX_PENDING_MESSAGES_PER_CONNECTION,
        maxPayloadBytes: env.WS_MAX_PAYLOAD_BYTES,
        messagesPerSecond: env.WS_MESSAGES_PER_SECOND,
        handshakeTimeoutMs: env.WS_HANDSHAKE_TIMEOUT_MS,
        messageTimeoutMs: env.WS_MESSAGE_TIMEOUT_MS,
    }));

export const websocketConfig = registerAs('websocket', () =>
    parseEnvironment(websocketConfigSchema, 'WebSocket')
);
export type WebsocketConfig = ConfigType<typeof websocketConfig>;
