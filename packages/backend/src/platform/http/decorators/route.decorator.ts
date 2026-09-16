import {
    ErrorRegistry,
    SystemExceptionCode,
    ClientExceptionCode,
} from '@/platform/errors/index.js';
import { toKebabCase } from '@/common/utils/index.js';

import { APP_VERSION, ERROR_REFERENCE_URL } from '@/config/index.js';

import { applyDecorators, Type } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { ulid } from 'ulid';

/** 认证策略的元数据键，供 AuthGuard 读取 */
export const AUTH_STRATEGY_KEY = 'auth:strategy';

/** 认证策略类型枚举 */
export type AUTH_STRATEGY_TYPE = 'public' | 'optional' | 'required';

/**
 * 路由错误码声明列表的元数据键。
 * 当前由 `buildErrorApiResponses` 在装饰器阶段内联生成 ApiResponse，
 * `enrichErrorResponses` 文档后处理阶段补充 schema 定义。
 */
export const ROUTE_ERRORS_KEY = 'route:errors';

/**
 * 所有路由自动追加的错误码。
 * 对应类在 @/platform/errors/client.exception.ts 与 system.exception.ts 中注册，
 * 随 ErrorRegistry 导入自动就位。
 */
const BASE_ERROR_CODES = [
    ...Object.values(ClientExceptionCode),
    ...Object.values(SystemExceptionCode),
] as const;

export interface ApiRouteOptions {
    /** 认证策略（默认 'required'） */
    auth: AUTH_STRATEGY_TYPE;

    /** Swagger 操作摘要（必填），显示在端点标题 */
    summary: string;

    /** 接口详细说明，支持 Markdown */
    description?: string;

    /**
     * 成功响应类型，支持三种形式：
     * - DTO 类（`createZodDto` 产物）：适用于 object 类型响应，例如 `UserDto`
     * - DTO 类数组（单元素数组）：适用于数组类型响应，例如 `[UserDto]`
     * - 原始 OpenAPI schema 对象：适用于 primitive 类型（string、number、boolean 等），
     *   例如 `{ type: 'string', example: 'ok' }`
     *
     * 装饰器将自动包裹入 ResponseFormatInterceptor 的统一包络：
     * `{ success: true, data: <responseType>, timestamp, context }`
     */
    responseType?: Type<unknown> | [Type<unknown>] | Record<string, unknown>;

    /** 成功响应的 HTTP 状态码（默认 200） */
    successStatus?: number;

    /**
     * 该路由可能抛出的业务错误码列表（ErrorRegistry 中已注册的 code 字符串）。
     *
     * 以下错误码无需声明，装饰器自动追加：
     * - CLIENT_REQUEST_RATE_LIMIT_EXCEEDED（所有路由）
     * - SYS_UNEXPECTED_ERROR（所有路由）
     *
     * auth='required' 路由的认证失败错误（AUTH_TOKEN_MISSING、AUTH_TOKEN_INVALID）
     * 由各路由按需在此处手动声明，确保与异常注册加载顺序解耦。
     */
    errors?: string[];

    /** 该路由接受的 Content-Type 列表（默认 [application/json, application/x-www-form-urlencoded]）*/
    consumes?: string[];

    /** 标记为已废弃接口 */
    deprecated?: boolean;
}

/**
 * 路由契约装饰器——将认证策略、Swagger 文档、错误声明聚合为单次声明。
 *
 * 消费层分工：
 * - `SetMetadata(AUTH_STRATEGY_KEY)` → `AuthGuard` 通过 Reflector 读取，决定放行/拦截
 * - `SetMetadata(ROUTE_ERRORS_KEY)`  → OpenAPI 富化阶段读取，生成错误响应文档（当前由 buildErrorApiResponses 直接生成）
 * - `ApiOperation / ApiResponse`     → `@nestjs/swagger` 直接消费，写入 OpenAPI spec
 *
 * @example
 * // 公开路由
 * \@ApiRoute({ auth: 'public', summary: '获取所有错误码' })
 *
 * // 需认证路由，显式声明业务错误
 * \@ApiRoute({
 *   summary: '创建用户',
 *   responseType: UserDto,
 *   errors: ['AUTH_USER_DUPLICATE', 'AUTH_TOKEN_MISSING', 'AUTH_TOKEN_INVALID'],
 * })
 */
export const ApiRoute = (options: ApiRouteOptions) => {
    const auth = options.auth ?? 'required';
    //prettier-ignore
    // TODO(identity): IdentityKernel 尚未重新暴露稳定的认证问题定义；恢复其公开契约后，
    // 可在此显式追加 required 路由共有的认证错误码。
    const EXTERNAL_ERROR_CODES: string[] = [];

    const allErrorCodes = [
        ...new Set([...(options.errors ?? []), ...BASE_ERROR_CODES, ...EXTERNAL_ERROR_CODES]),
    ];

    const allowedContentTypes = options.consumes ?? [
        'application/json',
        'application/x-www-form-urlencoded',
    ];

    return applyDecorators(
        // 1. 认证元数据
        SetMetadata(AUTH_STRATEGY_KEY, auth),
        // 2. 错误码元数据（供调试 / 运行时反射读取）
        SetMetadata(ROUTE_ERRORS_KEY, allErrorCodes),
        // 3. Swagger 操作说明
        ApiOperation({
            summary: options.summary,
            description: options.description,
            deprecated: options.deprecated,
        }),
        ApiConsumes(...allowedContentTypes),
        // 4. 成功响应包络（有 responseType 时展开）
        ...(options.responseType
            ? [buildSuccessApiResponse(options.responseType, options.successStatus ?? 200)]
            : []),
        // 5. 错误响应（按 statusCode 分组，从 ErrorRegistry 查询）
        ...buildErrorApiResponses(allErrorCodes),
        // 6. Bearer 认证标识（非公开路由）
        ...(auth !== 'public' ? [ApiBearerAuth('accessToken')] : [])
    );
};

/**
 * 构造成功响应 ApiResponse 装饰器。
 * 包络结构由 wrapSuccessResponses 文档后处理统一注入，此处只声明裸数据类型。
 *
 * - DTO 类 → 使用 `type: dto`（@nestjs/swagger 通过反射读取 schema）
 * - 单元素 DTO 数组 `[DtoClass]` → 使用 `type: dto, isArray: true`（文档化数组响应）
 * - 原始 schema 对象 → 使用 `schema`（直接嵌入，适用于 string/number/boolean 等 primitive）
 */
function buildSuccessApiResponse(
    responseType: Type<unknown> | [Type<unknown>] | Record<string, unknown>,
    status: number
) {
    if (Array.isArray(responseType)) {
        return ApiResponse({
            status,
            type: responseType[0],
            isArray: true,
            description: '操作成功',
        });
    }
    if (typeof responseType === 'function') {
        return ApiResponse({ status, type: responseType, description: '操作成功' });
    }
    return ApiResponse({ status, schema: responseType, description: '操作成功' });
}

/**
 * 根据 ErrorRegistry 将错误码按 statusCode 分组，
 * 同组多个错误以 OpenAPI examples 区分，生成对应的 ApiResponse 装饰器列表。
 *
 * 未在 ErrorRegistry 中注册的错误码（如加载顺序问题导致的空值）会被静默跳过，
 * 仍存储于 ROUTE_ERRORS_KEY 元数据中供后续富化器使用。
 */
function buildErrorApiResponses(codes: readonly string[]) {
    const grouped = new Map<number, { code: string; message: string }[]>();

    for (const code of codes) {
        const meta = ErrorRegistry.get(code);
        if (!meta) continue; // 未注册（可能尚未加载），静默跳过

        const list = grouped.get(meta.statusCode) ?? [];
        list.push({ code: meta.code, message: meta.message });
        grouped.set(meta.statusCode, list);
    }

    return [...grouped.entries()].map(([statusCode, entries]) =>
        ApiResponse({
            status: statusCode,
            description: entries.map((e) => e.message).join(' / '),
            content: {
                'application/json': {
                    examples: Object.fromEntries(
                        entries.map(({ code, message }) => [
                            code,
                            {
                                summary: message,
                                value: {
                                    success: false,
                                    code,
                                    message,
                                    type: `${ERROR_REFERENCE_URL}#${toKebabCase(code)}`,
                                    timestamp: new Date().toISOString(),
                                    context: {
                                        requestId: ulid(),
                                        time: Date.now(),
                                        version: APP_VERSION,
                                        metadata: {},
                                    },
                                    details: null,
                                },
                            },
                        ])
                    ),
                },
            },
        })
    );
}
