import type { RequestAuthentication } from '../request.type.js';

// NestJS Fastify middleware receives raw Node.js objects (via middie).
// Augment IncomingMessage so that properties set in middleware are properly typed.
declare module 'http' {
    interface IncomingMessage {
        /** Copied from FastifyRequest.id by middie before middleware runs */
        id?: string | number;
        /** Set by RequestPreprocessingMiddleware; read via request.raw.version in interceptors */
        version?: string;
    }
}

declare module 'fastify' {
    interface FastifyRequest {
        /** Null until AuthGuard successfully verifies the request's access token. */
        authentication: RequestAuthentication | null;
    }
}

export {};
