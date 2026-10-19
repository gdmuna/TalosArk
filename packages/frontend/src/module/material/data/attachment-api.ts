import {
    MaterialAttachmentBeginSchema,
    MaterialAttachmentCompleteSchema,
    MaterialAttachmentDownloadSchema,
    MaterialAttachmentPageSchema,
    MaterialAttachmentProgressSchema,
    MaterialAttachmentQuerySchema,
    MaterialAttachmentReferenceSchema,
    MaterialAttachmentUploadSchema,
    MaterialAttachmentPresignedRequestSchema,
    type MaterialScope,
} from '@talos-ark/contracts/material';
import { HttpError, type HttpClient } from '@/platform/http';
import type { MaterialAttachmentDataSource } from './source';

const root = (scope: MaterialScope, id: string) =>
    `/organization/${encodeURIComponent(scope.organizationId)}/workspace/${encodeURIComponent(scope.workspaceId)}/material/${encodeURIComponent(id)}/attachment`;
const sessionPath = (scope: MaterialScope, id: string, sessionId: string) =>
    `${root(scope, id)}/upload/${encodeURIComponent(sessionId)}`;

export function createHttpMaterialAttachmentDataSource(
    http: HttpClient
): MaterialAttachmentDataSource {
    return {
        list: (scope, id, query, signal) =>
            http.request({
                method: 'GET',
                path: root(scope, id),
                params: MaterialAttachmentQuerySchema.parse(query),
                schema: MaterialAttachmentPageSchema,
                signal,
                retry: false,
            }),
        async begin(scope, id, body, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${root(scope, id)}/upload`,
                body: MaterialAttachmentBeginSchema.parse(body),
                schema: MaterialAttachmentUploadSchema,
                signal,
                retry: false,
            });
            if (
                result.filename !== body.filename ||
                result.sizeBytes !== String(body.sizeBytes) ||
                result.mode !== body.mode ||
                result.contentType !== body.contentType
            )
                throw new HttpError('附件上传会话与原文件不匹配', 'protocol');
            return result;
        },
        async sign(scope, id, sessionId, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${sessionPath(scope, id, sessionId)}/sign`,
                body: {},
                schema: MaterialAttachmentPresignedRequestSchema,
                signal,
                retry: false,
            });
            if (result.method !== 'PUT') throw new HttpError('附件上传签名方法不匹配', 'protocol');
            return result;
        },
        async progress(scope, id, sessionId, signal) {
            const result = await http.request({
                method: 'GET',
                path: sessionPath(scope, id, sessionId),
                schema: MaterialAttachmentProgressSchema,
                signal,
                retry: false,
            });
            if (result.session.id !== sessionId)
                throw new HttpError('附件会话身份不匹配', 'protocol');
            return result;
        },
        async complete(scope, id, sessionId, body, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${sessionPath(scope, id, sessionId)}/complete`,
                body: MaterialAttachmentCompleteSchema.parse(body),
                schema: MaterialAttachmentUploadSchema,
                signal,
                retry: false,
            });
            if (result.id !== sessionId) throw new HttpError('附件会话身份不匹配', 'protocol');
            return result;
        },
        async cancel(scope, id, sessionId, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${sessionPath(scope, id, sessionId)}/cancel`,
                schema: MaterialAttachmentUploadSchema,
                signal,
                retry: false,
            });
            if (result.id !== sessionId) throw new HttpError('附件会话身份不匹配', 'protocol');
            return result;
        },
        bind: (scope, id, assetId, signal) =>
            http.request({
                method: 'POST',
                path: root(scope, id),
                body: { assetId },
                schema: MaterialAttachmentReferenceSchema,
                signal,
                retry: false,
            }),
        async download(scope, id, referenceId, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${root(scope, id)}/${encodeURIComponent(referenceId)}/download`,
                schema: MaterialAttachmentDownloadSchema,
                signal,
                retry: false,
            });
            if (result.attachment.id !== referenceId || result.request.method !== 'GET')
                throw new HttpError('附件下载身份不匹配', 'protocol');
            return result;
        },
        async unbind(scope, id, referenceId, signal) {
            const result = await http.request({
                method: 'POST',
                path: `${root(scope, id)}/${encodeURIComponent(referenceId)}/unbind`,
                schema: MaterialAttachmentReferenceSchema,
                signal,
                retry: false,
            });
            if (result.id !== referenceId || !result.removedAt)
                throw new HttpError('附件移除回执不一致', 'protocol');
            return result;
        },
    };
}
