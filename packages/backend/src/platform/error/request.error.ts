import type { ValidationIssue } from '@talos-ark/contracts/protocol';
import type { z } from 'zod';

export type RequestFailure =
    | { reason: 'validation'; issues: ValidationIssue[] }
    | {
          reason:
              | 'authentication'
              | 'forbidden'
              | 'notFound'
              | 'rateLimited'
              | 'payloadTooLarge'
              | 'unsupportedContent'
              | 'processingTimeout'
              | 'notImplemented'
              | 'invalid';
      };

export class RequestError extends Error {
    constructor(
        readonly failure: RequestFailure,
        options?: ErrorOptions
    ) {
        super(`Request rejected: ${failure.reason}`, options);
        this.name = 'RequestError';
    }
}

export function validationIssues(error: z.ZodError): ValidationIssue[] {
    const messages: Record<string, string> = {
        invalid_type: 'Unexpected field type',
        too_small: 'Value is below the minimum',
        too_big: 'Value exceeds the maximum',
        invalid_format: 'Invalid field format',
        unrecognized_keys: 'Unexpected fields',
    };
    return error.issues.map((issue) => ({
        path: issue.path.map((part) => (typeof part === 'number' ? part : String(part))),
        code: issue.code,
        // Custom refinement messages can contain the rejected value.
        message: messages[issue.code] ?? 'Invalid field value',
    }));
}
