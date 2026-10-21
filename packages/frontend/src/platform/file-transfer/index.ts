interface SignedRequest {
    url: string;
    method: 'GET' | 'PUT';
    headers: Record<string, string>;
    expiresAt: string;
}

function transferUrl(request: SignedRequest, method: SignedRequest['method']) {
    const url = new URL(request.url);
    if (
        request.method !== method ||
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
    )
        throw new Error('文件签名请求无效');
    if (Date.parse(request.expiresAt) <= Date.now()) throw new Error('文件签名已过期，请重试');
    return url.href;
}

export async function hashFile(file: File) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Storage signatures are used directly; application cookies and bearer tokens are never attached.
function uploadPut<T>(
    request: SignedRequest,
    body: Blob,
    signal: AbortSignal,
    progress: (value: number) => void,
    subject: '文件' | '分片',
    onSuccess: (response: XMLHttpRequest) => T
) {
    const url = transferUrl(request, 'PUT');
    const retryTarget = subject === '分片' ? '原分片' : '原上传';
    return new Promise<T>((resolve, reject) => {
        signal.throwIfAborted();
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        let settled = false;
        const finish = (error?: Error, value?: T) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', abort);
            if (error) reject(error);
            else resolve(value as T);
        };
        xhr.open('PUT', url);
        xhr.withCredentials = false;
        xhr.timeout = 300_000;
        for (const [name, value] of Object.entries(request.headers))
            xhr.setRequestHeader(name, value);
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                finish(new Error(`${subject}上传失败，请重试${retryTarget}`));
                return;
            }
            try {
                finish(undefined, onSuccess(xhr));
            } catch (cause) {
                finish(cause instanceof Error ? cause : new Error('文件上传响应无效'));
            }
        };
        xhr.onerror = () => finish(new Error('无法连接文件存储，请检查网络或存储跨域配置'));
        xhr.ontimeout = () => finish(new Error(`${subject}传输超时，请重试${retryTarget}`));
        xhr.onabort = () => finish(new DOMException('File transfer aborted', 'AbortError'));
        signal.addEventListener('abort', abort, { once: true });
        xhr.send(body);
    });
}

export function uploadFile(
    request: SignedRequest,
    file: File,
    signal: AbortSignal,
    progress: (value: number) => void
) {
    return uploadPut(request, file, signal, progress, '文件', () => undefined);
}

export function uploadMultipartPart(
    request: SignedRequest,
    part: Blob,
    signal: AbortSignal,
    progress: (value: number) => void
) {
    return uploadPut(request, part, signal, progress, '分片', (xhr) => {
        const etag = xhr.getResponseHeader('ETag');
        if (!etag) throw new Error('存储未返回分片 ETag，请检查存储跨域暴露头配置');
        return etag;
    });
}

export async function downloadFile(request: SignedRequest, filename: string, signal: AbortSignal) {
    const response = await fetch(transferUrl(request, 'GET'), {
        method: 'GET',
        headers: request.headers,
        signal,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
    });
    if (!response.ok) throw new Error('文件下载失败，请重新获取下载链接');
    const blob = await response.blob();
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
