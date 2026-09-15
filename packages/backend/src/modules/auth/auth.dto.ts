import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

const RegisterDtoSchema = z
    .object({
        username: z.string().min(3).max(32).meta({
            title: '用户名',
            example: 'user0',
        }),
        email: z.email().meta({
            title: '邮箱',
            example: 'user0@example.com',
        }),
        password: z.string().min(8).max(128).meta({
            title: '密码',
            example: 'password',
        }),
    })
    .meta({ description: '注册请求体' });

export class RegisterDto extends createZodDto(RegisterDtoSchema) {}

const LoginDtoSchema = z
    .object({
        account: z.string().min(1).max(128).meta({
            title: '用户名或邮箱',
            example: 'user0',
        }),
        password: z.string().min(8).max(128).meta({
            title: '密码',
            example: 'password',
        }),
    })
    .meta({ description: '登录请求体' });

export class LoginDto extends createZodDto(LoginDtoSchema) {}

const AccessTokenDtoSchema = z
    .object({
        accessToken: z.string().min(1).meta({
            title: '访问令牌',
            example:
                'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMUtOOUMyWEY5RUpIVjNQMENBWTNOWFNNWSIsImp0aSI6IjAxS05DTVE0N1I4R0c4V1kxQkQ3TTNKOU1SIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwiaWF0IjoxNzc1MzE5NjE3LCJleHAiOjE3NzUzMjA1MTd9.gsIPwms-A7njDj7dS3qai6i8AXs5Tet-z_ibW8iFs6r3tnDSx8YlKRe1UWMSsOxYqMtsxnrmY-LwuSEGZybeFA',
        }),
    })
    .meta({ description: '访问令牌响应体' });

export class AccessTokenDto extends createZodDto(AccessTokenDtoSchema) {}

const AuthUserDtoSchema = z
    .object({
        id: z.string().meta({
            title: '用户 ID',
            example: '01KN9C2XF9EJHV3P0CAY3NXSMY',
        }),
        username: z.string().meta({
            title: '用户名',
            example: 'user0',
        }),
        email: z.email().meta({
            title: '邮箱',
            example: 'user0@example.com',
        }),
    })
    .meta({ title: '认证用户信息' });

const AuthResponseDtoSchema = z
    .object({
        accessToken: z.string().min(1).meta({
            title: '访问令牌',
            example:
                'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMUtOOUMyWEY5RUpIVjNQMENBWTNOWFNNWSIsImp0aSI6IjAxS05DTVE0N1I4R0c4V1kxQkQ3TTNKOU1SIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwiaWF0IjoxNzc1MzE5NjE3LCJleHAiOjE3NzUzMjA1MTd9.gsIPwms-A7njDj7dS3qai6i8AXs5Tet-z_ibW8iFs6r3tnDSx8YlKRe1UWMSsOxYqMtsxnrmY-LwuSEGZybeFA',
        }),
        user: AuthUserDtoSchema,
    })
    .meta({ description: '登录/注册响应体' });

export class AuthResponseDto extends createZodDto(AuthResponseDtoSchema) {}

const OidcAuthorizationUrlDtoSchema = z
    .object({
        authorizationUrl: z.url().meta({
            title: '第三方登录授权地址',
            example:
                'https://casdoor.example.com/login/oauth/authorize?response_type=code&client_id=talos-ark',
        }),
    })
    .meta({ description: '第三方登录授权地址响应体' });

export class OidcAuthorizationUrlDto extends createZodDto(OidcAuthorizationUrlDtoSchema) {}

const OidcCallbackDtoSchema = z
    .object({
        code: z.string().min(1).max(4096).meta({ title: '授权码' }),
        state: z.string().min(1).max(512).meta({ title: '登录事务状态' }),
    })
    .meta({ description: 'OIDC 回调查询参数' });

export class OidcCallbackDto extends createZodDto(OidcCallbackDtoSchema) {}
