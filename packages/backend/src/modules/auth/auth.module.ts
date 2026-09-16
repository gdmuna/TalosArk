import { AuthController } from './auth.controller.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [],
    controllers: [AuthController],
    providers: [],
    exports: [],
})
export class AuthModule {}
