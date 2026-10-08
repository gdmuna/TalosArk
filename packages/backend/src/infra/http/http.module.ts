import { HttpClientFactory } from './http-client.factory.js';

import { Module } from '@nestjs/common';

@Module({
    providers: [HttpClientFactory],
    exports: [HttpClientFactory],
})
export class HttpModule {}
