import { APP_VERSION } from '@/config/app.config.js';

import type { OpenAPIObject } from '@nestjs/swagger';
import { ulid } from 'ulid';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

type JsonContent = { schema?: Record<string, unknown> };
type ResponseEntry = { content?: Record<string, JsonContent> };
type OperationLike = { responses?: Record<string, ResponseEntry> };

/**
 * OpenAPI 文档后处理：将所有 2xx 成功响应包裹入统一包络格式。
 *
 * 包络结构与运行时 ResponseFormatInterceptor 输出保持一致：
 * ```json
 * { "success": true, "data": <DTO>, "timestamp": "...", "context": { ... } }
 * ```
 *
 * 在 `SwaggerModule.createDocument` 和 `cleanupOpenApiDoc` 之后、
 * `SwaggerModule.setup` 之前调用。
 */
export function wrapSuccessResponses(doc: OpenAPIObject): OpenAPIObject {
    for (const pathItem of Object.values(doc.paths ?? {})) {
        for (const method of HTTP_METHODS) {
            const operation = (pathItem as Record<string, unknown>)[method] as
                OperationLike | undefined;
            if (!operation?.responses) continue;

            for (const [statusCode, response] of Object.entries(operation.responses)) {
                const status = parseInt(statusCode, 10);
                if (status < 200 || status >= 300) continue;

                const jsonContent = response?.content?.['application/json'];
                if (!jsonContent?.schema) continue;

                jsonContent.schema = buildEnvelopeSchema(jsonContent.schema);
            }
        }
    }

    return doc;
}

/**
 * OpenAPI 文档后处理：为所有 4xx/5xx 错误响应注入统一错误体 Schema。
 *
 * `buildErrorApiResponses` 在路由装饰器阶段已生成 `examples`，
 * 但 OpenAPI 规范要求同时提供 `schema` 才能让 SDK / 类型生成工具推断错误类型。
 * 本函数补充缺失的 `schema`，与 `wrapSuccessResponses` 对成功响应的处理形成对称。
 *
 * 错误体结构与运行时 `AllExceptionFilter` 输出保持一致：
 * ```json
 * { "success": false, "code": "...", "message": "...", "type": "uri",
 *   "timestamp": "date-time", "context": { requestId, ... }, "details": null | FieldError[] }
 * ```
 *
 * 在 `wrapSuccessResponses` 之后、`SwaggerModule.setup` 之前调用。
 */
export function enrichErrorResponses(doc: OpenAPIObject): OpenAPIObject {
    for (const pathItem of Object.values(doc.paths ?? {})) {
        for (const method of HTTP_METHODS) {
            const operation = (pathItem as Record<string, unknown>)[method] as
                OperationLike | undefined;
            if (!operation?.responses) continue;

            for (const [statusCode, response] of Object.entries(operation.responses)) {
                const status = parseInt(statusCode, 10);
                if (status < 400) continue;

                const jsonContent = response?.content?.['application/json'];
                if (!jsonContent || jsonContent.schema) continue; // 已有 schema 时不覆盖

                jsonContent.schema = ERROR_RESPONSE_SCHEMA;
            }
        }
    }

    return doc;
}

const ERROR_RESPONSE_SCHEMA: Record<string, unknown> = {
    type: 'object',
    required: ['success', 'code', 'message', 'type', 'timestamp', 'context', 'details'],
    properties: {
        success: {
            type: 'boolean',
            example: false,
            description: '操作结果，失败时始终为 false',
            title: '操作结果标志',
        },
        code: {
            type: 'string',
            description: '错误码标识符',
        },
        message: {
            type: 'string',
            description: '错误的人类可读描述',
        },
        type: {
            type: 'string',
            format: 'uri',
            description: '错误文档链接',
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            example: new Date().toISOString(),
            description: '响应生成时间（ISO 8601）',
        },
        context: {
            nullable: true,
            description: '请求上下文，未进入 ALS 链路时为 null',
            type: 'object',
            required: ['requestId', 'time', 'version'],
            properties: {
                requestId: {
                    type: 'string',
                    example: ulid(),
                    description: '请求唯一 ID（ULID）',
                },
                time: {
                    type: 'number',
                    example: Date.now(),
                    description: 'Unix 时间戳（ms）',
                },
                version: {
                    type: 'string',
                    example: APP_VERSION,
                    description: '应用版本号',
                },
                metadata: {
                    type: 'object',
                    additionalProperties: true,
                    description: '额外上下文数据',
                },
            },
        },
        details: {
            nullable: true,
            description: '字段级错误详情，仅校验失败时填充，否则为 null',
            type: 'array',
            items: {
                type: 'object',
                required: ['field', 'message', 'code'],
                properties: {
                    field: { type: 'string', description: '出错字段路径' },
                    message: { type: 'string', description: '字段错误描述' },
                    code: { type: 'string', description: 'Zod 错误码' },
                },
            },
        },
    },
};

function buildEnvelopeSchema(dataSchema: Record<string, unknown>): Record<string, unknown> {
    return {
        type: 'object',
        required: ['success', 'data', 'timestamp', 'context'],
        properties: {
            success: {
                type: 'boolean',
                example: true,
                description: '操作结果标志',
            },
            data: dataSchema,
            timestamp: {
                type: 'string',
                format: 'date-time',
                example: new Date().toISOString(),
                description: '响应时间戳（ISO 8601）',
            },
            context: {
                type: 'object',
                description: '请求上下文',
                required: ['requestId', 'time', 'version'],
                properties: {
                    requestId: {
                        type: 'string',
                        example: ulid(),
                        description: '请求唯一标识（ULID）',
                    },
                    time: {
                        type: 'number',
                        example: Date.now(),
                        description: 'Unix 时间戳（ms）',
                    },
                    version: {
                        type: 'string',
                        example: APP_VERSION,
                        description: '应用版本号',
                    },
                    metadata: {
                        type: 'object',
                        additionalProperties: true,
                        description: '额外上下文数据',
                    },
                },
            },
        },
    };
}
