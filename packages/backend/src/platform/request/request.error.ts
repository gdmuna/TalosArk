import type { ValidationIssue } from '@talos-ark/contracts/protocol';
import { RequestErrorDefinition } from '@talos-ark/contracts/backend';
import { defineErrorClass } from '@/platform/error/error.factory.js';
import type { z } from 'zod';

export const RequestError = defineErrorClass(RequestErrorDefinition, { name: 'RequestError' });
// eslint-disable-next-line no-redeclare -- TypeScript value/type namespace pairing.
export type RequestError = InstanceType<typeof RequestError>;
export type RequestFailure = RequestError['failure'];

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
