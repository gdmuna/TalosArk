import { RegisterException } from '@/platform/errors/exception-registry.js';
import { ClientException } from '@/platform/errors/app.exception.js';

export const FileExceptionCode = {
    ACCESS_DENIED: 'FILE_ACCESS_DENIED',
    INVALID_FILE_TYPE: 'FILE_INVALID_TYPE',
    INVALID_DOMAIN: 'FILE_INVALID_DOMAIN',
    RECORD_NOT_FOUND: 'FILE_RECORD_NOT_FOUND',
    STAGING_NOT_FOUND: 'FILE_STAGING_NOT_FOUND',
    INTEGRITY_VIOLATION: 'FILE_INTEGRITY_VIOLATION',
} as const;

export abstract class FileException extends ClientException {}

@RegisterException({
    code: FileExceptionCode.ACCESS_DENIED,
    statusCode: 403,
    message: '无权访问该文件',
    description: '当前用户不是文件所有者，或文件不满足公开访问条件。',
    retryable: false,
    logLevel: 'info',
    causes: ['文件归属于其他用户', '文件不是可公开访问的活动文件'],
    hint: '确认文件归属和访问权限后重试',
})
export class FileAccessDeniedException extends FileException {}

@RegisterException({
    code: FileExceptionCode.INVALID_FILE_TYPE,
    statusCode: 422,
    message: '不支持的文件类型',
    description: '上传文件的 MIME 类型与所选领域（domain）不匹配，请确认文件类型后重新上传',
    retryable: false,
    logLevel: 'info',
    causes: ['文件 MIME 类型不在该领域的允许列表内'],
    hint: '查看该领域（domain）支持的文件类型列表，更换符合要求的文件后重试',
})
export class FileInvalidTypeException extends FileException {}

@RegisterException({
    code: FileExceptionCode.INVALID_DOMAIN,
    statusCode: 400,
    message: '无效的文件领域',
    description: '提供的文件领域（domain）不在系统支持的范围内',
    retryable: false,
    logLevel: 'info',
    causes: ['domain 参数不在 avatar / video / document 取值范围内'],
    hint: '使用合法的 domain 值：avatar、video 或 document',
})
export class FileInvalidDomainException extends FileException {}

@RegisterException({
    code: FileExceptionCode.RECORD_NOT_FOUND,
    statusCode: 404,
    message: '文件记录不存在',
    description: '指定的文件 ID 在系统中未找到对应的记录',
    retryable: false,
    logLevel: 'info',
    causes: ['fileId 不存在或已被删除'],
    hint: '确认 fileId 正确，或重新上传文件',
})
export class FileRecordNotFoundException extends FileException {}

@RegisterException({
    code: FileExceptionCode.STAGING_NOT_FOUND,
    statusCode: 409,
    message: '暂存对象未找到',
    description:
        '调用 confirmUpload 时，对应的文件尚未上传到暂存桶，或上传已被存储层拒绝（checksum 不符）',
    retryable: false,
    logLevel: 'warn',
    causes: [
        '客户端尚未完成上传',
        '上传内容与声明的 sha256 不符导致被 S3 拒绝',
        '预签名 URL 已过期',
    ],
    hint: '确认文件已成功上传后再调用 confirmUpload，如预签名 URL 已过期请重新申请',
})
export class FileStagingNotFoundException extends FileException {}

@RegisterException({
    code: FileExceptionCode.INTEGRITY_VIOLATION,
    statusCode: 422,
    message: '文件完整性校验失败',
    description: '服务端检测到上传文件的 sha256 与客户端声明不一致，拒绝激活该文件记录',
    retryable: false,
    logLevel: 'warn',
    causes: ['上传过程中文件内容被篡改', '客户端计算 sha256 时使用了错误的算法或编码'],
    hint: '重新计算文件 sha256（小写十六进制）后重新上传',
})
export class FileIntegrityViolationException extends FileException {}
