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
export function uploadFile(
    request: SignedRequest,
    file: File,
    signal: AbortSignal,
    progress: (value: number) => void
) {
    const url = transferUrl(request, 'PUT');
    return new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        const finish = (error?: Error) => {
            signal.removeEventListener('abort', abort);
            if (error) reject(error);
            else resolve();
        };
        xhr.open('PUT', url);
        xhr.withCredentials = false;
        xhr.timeout = 300_000;
        for (const [name, value] of Object.entries(request.headers))
            xhr.setRequestHeader(name, value);
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () =>
            finish(
                xhr.status >= 200 && xhr.status < 300
                    ? undefined
                    : new Error('文件上传失败，请重试原上传')
            );
        xhr.onerror = () => finish(new Error('无法连接文件存储，请检查网络或存储跨域配置'));
        xhr.ontimeout = () => finish(new Error('文件传输超时，请重试原上传'));
        xhr.onabort = () => finish(new DOMException('File transfer aborted', 'AbortError'));
        signal.addEventListener('abort', abort, { once: true });
        xhr.send(file);
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
