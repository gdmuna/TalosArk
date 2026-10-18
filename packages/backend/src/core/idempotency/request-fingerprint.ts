import { createHash } from 'node:crypto';
import { canonicalJson } from './internal/canonical-json.js';
import { fingerprintInputSchema, parseIdempotencyInput } from './internal/idempotency.rules.js';

export class RequestFingerprint {
    static create(input: {
        readonly operation: string;
        readonly version?: number;
        readonly payload: unknown;
    }): string {
        const value = parseIdempotencyInput(fingerprintInputSchema, input);
        const payload = canonicalJson(value.payload);
        return createHash('sha256')
            .update('talosark.idempotency:1\n')
            .update(JSON.stringify([value.version, value.operation, payload]))
            .digest('hex');
    }
}
