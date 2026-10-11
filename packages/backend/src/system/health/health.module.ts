import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthState } from './health.state.js';

@Module({
    controllers: [HealthController],
    providers: [HealthState],
    exports: [HealthState],
})
export class HealthModule {}
