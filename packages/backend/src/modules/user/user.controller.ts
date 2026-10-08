import { UserService } from './user.service.js';

import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';

import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'get user',
        responses: [{ status: 200, schema: z.null() }],
    })
    async getUser(@Query('id') id: string) {}

    @Get('me')
    @ApiRoute({
        auth: 'required',
        summary: 'get me',
        responses: [{ status: 200, schema: z.null() }],
    })
    async getMe() {}
}
