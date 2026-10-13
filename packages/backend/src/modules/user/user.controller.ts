import { UserService } from './user.service.js';

import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';

import { Controller, Get, Req, Res } from '@nestjs/common';
import {
    CurrentAccountResponseSchema,
    type CurrentAccountResponse,
} from '@talos-ark/contracts/auth';
import { IdentityErrorDefinition } from '@talos-ark/contracts/backend';
import { RequestError } from '@/platform/request/request.error.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get('me')
    @ApiRoute({
        auth: 'required',
        summary: 'Read the authenticated current account',
        responses: [{ status: 200, schema: CurrentAccountResponseSchema }],
        errors: [IdentityErrorDefinition['login-unavailable']],
    })
    async getMe(
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply
    ): Promise<CurrentAccountResponse> {
        if (!request.jwtClaim) throw new RequestError({ reason: 'authentication' });
        reply.header('Cache-Control', 'no-store');
        return this.userService.getMe(request.jwtClaim.sub);
    }
}
