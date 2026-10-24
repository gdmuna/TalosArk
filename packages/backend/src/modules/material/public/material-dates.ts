import type { Expiry } from '@talos-ark/contracts/material';
import { MaterialError } from '../application/material.error.js';

export function calendarDate(value: Date | null): string | null {
    return value?.toISOString().slice(0, 10) ?? null;
}
export function expiryValue(value: {
    expiryKind: 'UNKNOWN' | 'NONE' | 'DATED';
    expiresOn: Date | null;
}): Expiry {
    if (value.expiryKind === 'DATED') {
        if (!value.expiresOn) throw new Error('DATED expiry has no date');
        return { kind: 'DATED', date: value.expiresOn.toISOString().slice(0, 10) };
    }
    return { kind: value.expiryKind };
}
export function materialDateFields(input: { manufacturedOn: string | null; expiry: Expiry }) {
    if (
        input.manufacturedOn &&
        input.expiry.kind === 'DATED' &&
        input.expiry.date < input.manufacturedOn
    )
        throw new MaterialError({ reason: 'invalid' });
    return {
        manufacturedOn: input.manufacturedOn
            ? new Date(`${input.manufacturedOn}T00:00:00.000Z`)
            : null,
        expiryKind: input.expiry.kind,
        expiresOn:
            input.expiry.kind === 'DATED' ? new Date(`${input.expiry.date}T00:00:00.000Z`) : null,
    };
}
