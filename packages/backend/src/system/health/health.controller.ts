import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SystemErrorDefinition } from '@talos-ark/contracts/backend';
import {
    LivenessResponseSchema,
    ReadinessResponseSchema,
    type LivenessResponse,
    type ReadinessResponse,
} from '@talos-ark/contracts/system';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { HealthError } from './health.error.js';
import { HealthState } from './health.state.js';

@SkipThrottle()
@Controller('health')
export class HealthController {
    constructor(private readonly state: HealthState) {}

    @Get('live')
    @ApiRoute({
        auth: 'public',
        summary: 'HTTP process liveness',
        responses: [{ status: 200, schema: LivenessResponseSchema }],
    })
    live(): LivenessResponse {
        return { status: 'alive' };
    }

    @Get('ready')
    @ApiRoute({
        auth: 'public',
        summary: 'Process readiness',
        description:
            'Initialization completed and shutdown has not started. Not a live dependency check.',
        responses: [{ status: 200, schema: ReadinessResponseSchema }],
        errors: [SystemErrorDefinition.notReady],
    })
    ready(): ReadinessResponse {
        if (!this.state.isReady) throw new HealthError({ reason: 'notReady' });
        return { status: 'ready', scope: 'process' };
    }
}
