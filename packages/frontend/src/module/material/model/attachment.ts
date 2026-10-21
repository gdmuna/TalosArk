import { onScopeDispose, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { z } from 'zod';
import {
    MaterialAttachmentBeginSchema,
    MaterialAttachmentUploadSchema,
    MaterialAttachmentReferenceSchema,
    type MaterialScope,
} from '@talos-ark/contracts/material';
import { HttpError } from '@/platform/http';
import { hashFile, uploadFile, uploadMultipartPart } from '@/platform/file-transfer';
import type { MaterialDataSource } from '../data/source';

const jobSchema = z.object({
    scope: z.object({ organizationId: z.uuid(), workspaceId: z.uuid() }),
    materialId: z.uuid(),
    input: MaterialAttachmentBeginSchema,
    session: MaterialAttachmentUploadSchema.optional(),
    reference: MaterialAttachmentReferenceSchema.optional(),
    uncertainBegin: z.boolean().default(false),
});
type Job = z.infer<typeof jobSchema>;
export type MaterialAttachmentUploadMode = z.infer<typeof MaterialAttachmentBeginSchema>['mode'];
const jobKey = (scope: MaterialScope, materialId: string) =>
    `${scope.organizationId}/${scope.workspaceId}/${materialId}`;
const formats: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    tif: 'image/tiff',
    tiff: 'image/tiff',
};
export const materialAttachmentAccept = Object.keys(formats)
    .map((extension) => `.${extension}`)
    .join(',');
export function attachmentErrorMessage(cause: unknown) {
    const messages: Record<string, string> = {
        MATERIAL_ATTACHMENT_INVALID: '附件请求无效，请检查文件资料',
        MATERIAL_ATTACHMENT_UNAVAILABLE: '附件或上传会话不可用，或当前账户无权访问',
        MATERIAL_ATTACHMENT_STORAGE_UNAVAILABLE:
            '文件存储暂不可用，请联系管理员检查存储配置；未完成的上传可取消后重新选择文件',
        MATERIAL_ATTACHMENT_CONFLICT: '上传请求与原会话冲突，请核对原文件',
        MATERIAL_ATTACHMENT_EXPIRED: '上传会话已过期，请取消后重新选择文件',
        MATERIAL_ATTACHMENT_BUSY: '服务端仍在处理原上传，请稍后继续原上传',
        MATERIAL_ATTACHMENT_NOT_READY: '文件尚未上传完成，请继续原上传',
        MATERIAL_ATTACHMENT_FORMAT_NOT_ALLOWED: '此文件格式不受支持',
        MATERIAL_ATTACHMENT_SIZE_NOT_ALLOWED: '材料附件不得超过 100 MiB',
        MATERIAL_ATTACHMENT_INTEGRITY_MISMATCH: '文件校验失败，请重新选择原文件后继续',
        MATERIAL_ATTACHMENT_READONLY: '已归档材料的附件只读',
        MATERIAL_ATTACHMENT_IN_USE: '此文件已被使用，请重新加载附件列表核对',
    };
    if (cause instanceof HttpError)
        return messages[cause.code ?? ''] ?? '附件操作未完成，请重试原操作';
    return cause instanceof Error ? cause.message : '附件操作未完成';
}

function confirmedMultipartParts(
    parts: readonly { partNumber: number; etag: string; sizeBytes: number }[],
    partCount: number,
    partSize: number,
    totalSize: number
) {
    const confirmed = new Map<number, { etag: string; sizeBytes: number }>();
    for (const part of parts) {
        const expectedSize = Math.min(partSize, totalSize - (part.partNumber - 1) * partSize);
        if (
            !Number.isInteger(part.partNumber) ||
            part.partNumber < 1 ||
            part.partNumber > partCount ||
            !Number.isSafeInteger(part.sizeBytes) ||
            part.sizeBytes !== expectedSize ||
            confirmed.has(part.partNumber)
        )
            throw new Error('服务端返回的分片进度无效，请重新读取上传进度');
        confirmed.set(part.partNumber, { etag: part.etag, sizeBytes: part.sizeBytes });
    }
    return confirmed;
}

export const useMaterialAttachmentStore = defineStore('material-attachment', () => {
    const jobs = shallowRef<Job[]>([]);
    const busyKey = ref('');
    const stage = ref('');
    const progress = ref(0);
    const error = ref('');
    const errorKey = ref('');
    const recoveryError = ref('');
    const files = new Map<string, File>();
    let source: MaterialDataSource;
    let owner: string | undefined;
    let storageOwner = '';
    let controller: AbortController | undefined;
    const storageKey = () => `talos.material.attachment.${storageOwner}`;
    const current = (scope: MaterialScope | null, materialId: string) =>
        scope
            ? jobs.value.find(
                  (job) => jobKey(job.scope, job.materialId) === jobKey(scope, materialId)
              )
            : undefined;
    function save() {
        try {
            sessionStorage.setItem(storageKey(), JSON.stringify(jobs.value));
        } catch {
            throw new Error('无法保存上传恢复信息，请检查浏览器存储后继续原上传');
        }
    }
    function update(job: Job, patch: Partial<Job>) {
        const next = { ...job, ...patch };
        jobs.value = jobs.value.map((item) => (item === job ? next : item));
        save();
        return next;
    }
    function connect(value: MaterialDataSource, userId?: string) {
        source = value;
        if (owner === userId) return;
        controller?.abort();
        if (storageOwner && (userId === '' || (userId && userId !== storageOwner))) {
            try {
                sessionStorage.removeItem(storageKey());
            } catch {
                /* Logout must still clear in-memory state. */
            }
        }
        owner = userId;
        if (userId !== undefined) storageOwner = userId;
        jobs.value = [];
        files.clear();
        busyKey.value = stage.value = error.value = errorKey.value = recoveryError.value = '';
        if (!owner) return;
        try {
            const saved = sessionStorage.getItem(storageKey());
            if (saved)
                jobs.value = z
                    .array(jobSchema)
                    .parse(JSON.parse(saved))
                    .map((job) => ({ ...job, uncertainBegin: !job.session || job.uncertainBegin }));
        } catch {
            recoveryError.value = '无法读取原上传信息，请先核对材料附件，避免重复上传。';
        }
    }
    async function run(
        scope: MaterialScope,
        materialId: string,
        file?: File,
        mode: MaterialAttachmentUploadMode = 'single'
    ) {
        if (!owner || busyKey.value || recoveryError.value) return;
        const key = jobKey(scope, materialId);
        const request = new AbortController();
        controller = request;
        const signal = request.signal;
        const reportProgress = (value: number) => {
            if (controller === request && !signal.aborted) progress.value = value;
        };
        busyKey.value = key;
        errorKey.value = key;
        error.value = '';
        progress.value = 0;
        let job = current(scope, materialId);
        let beginning = false;
        try {
            if (file) {
                stage.value = '正在校验文件';
                const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
                if (!formats[extension]) throw new Error('此文件格式不受支持');
                if (file.size > 100 * 1024 * 1024) throw new Error('材料附件不得超过 100 MiB');
                if (mode === 'multipart' && file.size === 0)
                    throw new Error('空文件必须使用单次上传');
                const sha256 = await hashFile(file);
                signal.throwIfAborted();
                if (job) {
                    if (
                        sha256 !== job.input.sha256 ||
                        file.size !== job.input.sizeBytes ||
                        file.name !== job.input.filename
                    )
                        throw new Error('请选择与原上传名称、大小和内容相同的文件');
                } else {
                    job = {
                        scope: { ...scope },
                        materialId,
                        uncertainBegin: false,
                        input: {
                            idempotencyKey: crypto.randomUUID(),
                            filename: file.name,
                            contentType: file.type || formats[extension],
                            sizeBytes: file.size,
                            sha256,
                            mode,
                        },
                    };
                    jobs.value = [...jobs.value, job];
                    save();
                }
                files.set(key, file);
            }
            if (!job) return;
            if (job.reference) return;
            stage.value = '正在读取上传会话';
            beginning = !job.session;
            const progressSnapshot = job.session
                ? await source.attachments.progress(scope, materialId, job.session.id, signal)
                : undefined;
            let session =
                progressSnapshot?.session ??
                (await source.attachments.begin(scope, materialId, job.input, signal));
            signal.throwIfAborted();
            job = update(job, { session });
            beginning = false;
            if (session.status === 'cancelled' || session.status === 'expired')
                throw new Error('上传会话已结束，请取消此上传后重新选择文件');
            if (session.status !== 'completed') {
                const original = files.get(key);
                if (session.mode === 'single') {
                    stage.value = '正在确认上传结果';
                    try {
                        session = await source.attachments.complete(
                            scope,
                            materialId,
                            session.id,
                            {},
                            signal
                        );
                    } catch (cause) {
                        if (
                            !(cause instanceof HttpError) ||
                            cause.code !== 'MATERIAL_ATTACHMENT_NOT_READY'
                        )
                            throw cause;
                        if (!original)
                            throw new Error('请选择原文件以继续上传；原上传会话将被保留', {
                                cause,
                            });
                        stage.value = '正在上传';
                        const signed = await source.attachments.sign(
                            scope,
                            materialId,
                            session.id,
                            undefined,
                            signal
                        );
                        await uploadFile(signed, original, signal, reportProgress);
                        stage.value = '正在验证文件';
                        session = await source.attachments.complete(
                            scope,
                            materialId,
                            session.id,
                            {},
                            signal
                        );
                    }
                } else {
                    const partSize = session.partSizeBytes;
                    const expectedSize = Number(session.sizeBytes);
                    if (
                        !partSize ||
                        !Number.isSafeInteger(expectedSize) ||
                        session.partCount !== Math.ceil(expectedSize / partSize)
                    )
                        throw new Error('服务端分片计划无效，请保留原上传并联系管理员');
                    const latest =
                        progressSnapshot ??
                        (await source.attachments.progress(scope, materialId, session.id, signal));
                    signal.throwIfAborted();
                    if (latest.session.id !== session.id || latest.session.mode !== 'multipart')
                        throw new Error('原上传会话信息不一致，请保留恢复记录');
                    if (latest.session.status === 'completed') {
                        session = latest.session;
                        job = update(job, { session });
                    } else if (
                        latest.session.status !== 'open' &&
                        !latest.session.completionParts
                    ) {
                        throw new Error('原上传会话已结束或正在处理，请重新读取进度后继续');
                    } else {
                        const authoritativeSession = latest.session;
                        job = update(job, { session: authoritativeSession });
                        if (authoritativeSession.completionParts) {
                            stage.value = '正在恢复文件校验';
                            const recoveredParts = [...authoritativeSession.completionParts].sort(
                                (a, b) => a.partNumber - b.partNumber
                            );
                            if (
                                recoveredParts.length !== session.partCount ||
                                recoveredParts.some((part, index) => part.partNumber !== index + 1)
                            )
                                throw new Error('服务端完成清单与原文件计划不一致，请勿新建上传');
                            const manifest = recoveredParts.map((part) => ({
                                partNumber: part.partNumber,
                                etag: part.etag,
                            }));
                            session = await source.attachments.complete(
                                scope,
                                materialId,
                                session.id,
                                { parts: manifest },
                                signal
                            );
                        } else {
                            if (authoritativeSession.status !== 'open')
                                throw new Error('原上传正由服务端处理，请稍后重新读取进度');
                            const confirmed = confirmedMultipartParts(
                                latest.parts,
                                session.partCount,
                                partSize,
                                expectedSize
                            );
                            const confirmedBytes = () =>
                                [...confirmed.values()].reduce(
                                    (total, part) => total + part.sizeBytes,
                                    0
                                );
                            progress.value = Math.round((confirmedBytes() / expectedSize) * 100);
                            if (confirmed.size < session.partCount) {
                                if (!original)
                                    throw new Error('请选择原文件以继续上传；原上传会话将被保留');
                                if (original.size !== expectedSize)
                                    throw new Error('原文件大小与上传会话不匹配，请重新选择原文件');
                                stage.value = '正在上传分片';
                                for (
                                    let partNumber = 1;
                                    partNumber <= session.partCount;
                                    partNumber++
                                ) {
                                    signal.throwIfAborted();
                                    if (confirmed.has(partNumber)) continue;
                                    const start = (partNumber - 1) * partSize;
                                    const blob = original.slice(
                                        start,
                                        Math.min(start + partSize, original.size)
                                    );
                                    const signed = await source.attachments.sign(
                                        scope,
                                        materialId,
                                        session.id,
                                        partNumber,
                                        signal
                                    );
                                    const etag = await uploadMultipartPart(
                                        signed,
                                        blob,
                                        signal,
                                        (value) => {
                                            reportProgress(
                                                Math.round(
                                                    ((confirmedBytes() +
                                                        (blob.size * value) / 100) /
                                                        expectedSize) *
                                                        100
                                                )
                                            );
                                        }
                                    );
                                    signal.throwIfAborted();
                                    const snapshot = await source.attachments.progress(
                                        scope,
                                        materialId,
                                        session.id,
                                        signal
                                    );
                                    signal.throwIfAborted();
                                    if (
                                        snapshot.session.id !== session.id ||
                                        snapshot.session.mode !== 'multipart'
                                    )
                                        throw new Error(
                                            '分片尚未被存储确认，请重新读取上传进度后继续'
                                        );
                                    const refreshed = confirmedMultipartParts(
                                        snapshot.parts,
                                        session.partCount,
                                        partSize,
                                        expectedSize
                                    );
                                    const confirmedPart = refreshed.get(partNumber);
                                    if (!confirmedPart || confirmedPart.etag !== etag)
                                        throw new Error(
                                            '分片尚未被存储确认，请重新读取上传进度后继续'
                                        );
                                    confirmed.clear();
                                    for (const [number, part] of refreshed)
                                        confirmed.set(number, part);
                                    job = update(job, { session: snapshot.session });
                                }
                            }
                            const parts = [...confirmed]
                                .sort(([a], [b]) => a - b)
                                .map(([partNumber, part]) => ({ partNumber, etag: part.etag }));
                            if (parts.length !== session.partCount)
                                throw new Error('分片清单不完整，请重新读取上传进度后继续');
                            progress.value = 100;
                            stage.value = '正在合并并验证文件';
                            session = await source.attachments.complete(
                                scope,
                                materialId,
                                session.id,
                                { parts },
                                signal
                            );
                        }
                    }
                }
                signal.throwIfAborted();
                job = update(job, { session });
            }
            if (!session.assetId || session.status !== 'completed')
                throw new Error('原文件尚未完成验证，请继续原上传');
            stage.value = '正在添加材料附件';
            const reference = await source.attachments.bind(
                scope,
                materialId,
                session.assetId,
                signal
            );
            signal.throwIfAborted();
            update(job, { reference });
            files.delete(key);
        } catch (cause) {
            if (!signal.aborted) {
                if (beginning && job) {
                    const rejected =
                        !job.uncertainBegin &&
                        cause instanceof HttpError &&
                        cause.kind === 'api' &&
                        (cause.status ?? 500) >= 400 &&
                        (cause.status ?? 500) < 500;
                    if (rejected) {
                        jobs.value = jobs.value.filter((item) => item !== job);
                        files.delete(key);
                    } else
                        jobs.value = jobs.value.map((item) =>
                            item === job ? { ...item, uncertainBegin: true } : item
                        );
                    try {
                        save();
                    } catch {
                        recoveryError.value = '无法保存原上传状态，请先核对材料附件，勿新建上传。';
                    }
                }
                error.value = attachmentErrorMessage(cause);
            }
        } finally {
            if (controller === request) {
                busyKey.value = stage.value = '';
            }
        }
    }
    function acknowledge(scope: MaterialScope, materialId: string) {
        const job = current(scope, materialId);
        if (!job?.reference) return;
        const previous = jobs.value;
        jobs.value = jobs.value.filter((item) => item !== job);
        try {
            save();
            if (errorKey.value === jobKey(scope, materialId)) error.value = '';
            return true;
        } catch (cause) {
            jobs.value = previous;
            error.value = attachmentErrorMessage(cause);
            return false;
        }
    }
    async function cancel(scope: MaterialScope, materialId: string) {
        const job = current(scope, materialId);
        if (!job || busyKey.value || job.reference) return;
        const request = new AbortController();
        controller = request;
        busyKey.value = jobKey(scope, materialId);
        errorKey.value = busyKey.value;
        error.value = '';
        try {
            const session =
                job.session ??
                (await source.attachments.begin(scope, materialId, job.input, request.signal));
            request.signal.throwIfAborted();
            if (session.status === 'completed')
                throw new Error(
                    '文件已完成上传，请继续原上传确认绑定结果；已添加的附件可从列表移除。'
                );
            if (session.status !== 'cancelled' && session.status !== 'expired')
                await source.attachments.cancel(scope, materialId, session.id, request.signal);
            request.signal.throwIfAborted();
            jobs.value = jobs.value.filter((item) => item !== job);
            files.delete(jobKey(scope, materialId));
            save();
        } catch (cause) {
            if (!request.signal.aborted) error.value = attachmentErrorMessage(cause);
        } finally {
            if (controller === request) busyKey.value = '';
        }
    }
    onScopeDispose(() => controller?.abort());
    return {
        jobs,
        busyKey,
        stage,
        progress,
        error,
        errorKey,
        recoveryError,
        current,
        connect,
        run,
        cancel,
        acknowledge,
    };
});
