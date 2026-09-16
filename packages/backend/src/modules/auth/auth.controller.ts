import { Controller, Post } from '@nestjs/common';

@Controller('auth')
export class AuthController {
    @Post('oidc/login')
    oidcLogin() {}

    @Post('oidc/login-callback')
    oidcLoginCallback() {}
}
