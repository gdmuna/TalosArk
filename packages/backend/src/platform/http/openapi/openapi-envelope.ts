import { ApiErrorResponseSchema, ApiSuccessResponseSchema } from '@talos-ark/contracts/protocol';

import type { OpenAPIObject } from '@nestjs/swagger';
import { z } from 'zod';

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
 *   "timestamp": "date-time", "context": { requestId, ... }, "details": null | ... }
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

const ERROR_RESPONSE_SCHEMA = z.toJSONSchema(ApiErrorResponseSchema, {
    target: 'openapi-3.0',
});
const SUCCESS_RESPONSE_SCHEMA = z.toJSONSchema(ApiSuccessResponseSchema, {
    target: 'openapi-3.0',
});

function buildEnvelopeSchema(dataSchema: Record<string, unknown>): Record<string, unknown> {
    return {
        ...SUCCESS_RESPONSE_SCHEMA,
        properties: {
            ...SUCCESS_RESPONSE_SCHEMA.properties,
            data: dataSchema,
        },
    };
}
