import { HttpClientFactory } from './http-client.factory.js';

import { Module } from '@nestjs/common';
import { LoggerExtension } from '@/platform/observability/logger/logger-contribution.decorator.js';
import { httpLogContribution } from './http.log.contribution.js';

@LoggerExtension(httpLogContribution)
@Module({
    providers: [HttpClientFactory],
    exports: [HttpClientFactory],
})
export class HttpModule {}
