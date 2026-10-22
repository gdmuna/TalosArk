import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AllConfig } from '@/config/index.js';
import { durationAdvice } from '../observability/metrics/metric.policy.js';
import { currentTraceContext } from '../observability/tracing/trace.context.js';
import { LoggerExtension } from '../observability/logger/logger-contribution.decorator.js';
import { performanceLogContribution } from './interceptors/performance.log.contribution.js';

const meter = metrics.getMeter('talosark.http.server');
const count = meter.createCounter('http.server.requests', { unit: '{request}' });
const duration = meter.createHistogram('http.server.request.duration', {
    unit: 's',
    advice: durationAdvice,
});
const active = meter.createUpDownCounter('http.server.active_requests', { unit: '{request}' });
const method = (value: string) =>
    ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE'].includes(value)
        ? value
        : '_OTHER';

@LoggerExtension(performanceLogContribution)
@Injectable()
export class HttpObservation {
    constructor(
        private readonly config: ConfigService<AllConfig, true>,
        @InjectPinoLogger(HttpObservation.name) private readonly logger: PinoLogger
    ) {}

    register(instance: FastifyInstance): void {
        instance.addHook('onRequest', (request, reply, done) => {
            const start = performance.now();
            const labels = { 'http.request.method': method(request.method) };
            const correlation = currentTraceContext();
            const span = trace.getActiveSpan();
            let finished = false;
            active.add(1, labels);
            const finish = (aborted: boolean) => {
                if (finished) return;
                finished = true;
                const elapsed = performance.now() - start;
                const route = this.route(request, reply);
                const status = aborted ? 0 : reply.statusCode;
                const attributes = {
                    ...labels,
                    'http.route': route,
                    'http.response.status_code': status,
                    outcome: aborted ? 'aborted' : 'completed',
                };
                active.add(-1, labels);
                // The Fastify instrumentation owns end(); work may still finish after disconnect.
                if (aborted && span?.isRecording()) span.setStatus({ code: SpanStatusCode.ERROR });
                count.add(1, attributes);
                duration.record(elapsed / 1000, attributes);
                this.log(request, status, route, elapsed, aborted, correlation);
            };
            request.raw.once('aborted', () => finish(true));
            reply.raw.once('close', () => finish(!reply.raw.writableFinished));
            reply.raw.once('finish', () => finish(false));
            done();
        });
    }

    private route(request: FastifyRequest, reply: FastifyReply): string {
        return reply.statusCode === 404 && !request.routeOptions.url
            ? 'unmatched'
            : (request.routeOptions.url ?? 'unmatched');
    }

    private log(
        request: FastifyRequest,
        status: number,
        route: string,
        duration: number,
        aborted: boolean,
        correlation: ReturnType<typeof currentTraceContext>
    ) {
        const threshold = this.config.get('observability.slowRequestThreshold', { infer: true });
        const event =
            duration >= threshold.error
                ? 'http.request.critical'
                : duration >= threshold.warn
                  ? 'http.request.slow'
                  : aborted || status >= 400
                    ? 'http.request.failed'
                    : 'http.request.completed';
        const observation = {
            ...correlation,
            requestId: String(request.id),
            event,
            http: {
                method: request.method,
                url: route,
                status,
                duration: Math.round(duration),
                durationUnit: 'ms',
                hasError: aborted || status >= 400,
                aborted,
            },
        };
        const message = `${method(request.method)} ${route} Request ${aborted ? 'aborted' : status >= 400 ? 'failed' : 'completed'}`;
        if (duration >= threshold.error) this.logger.error(observation, message);
        else if (duration >= threshold.warn) this.logger.warn(observation, message);
        else if (aborted || status >= 400) this.logger.info(observation, message);
        else this.logger.debug(observation, message);
    }
}
