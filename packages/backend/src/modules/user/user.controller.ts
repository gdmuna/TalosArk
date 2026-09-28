import { UserService } from './user.service.js';

import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';

import { Controller, Get, Query } from '@nestjs/common';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'get user',
    })
    async getUser(@Query('id') id: string) {}

    @Get('me')
    @ApiRoute({
        auth: 'required',
        summary: 'get me',
    })
    async getMe() {}
}
