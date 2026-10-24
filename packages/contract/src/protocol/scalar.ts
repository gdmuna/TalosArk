import { z } from 'zod';

export const UuidSchema = z.uuid();
export const BusinessCodeInputSchema = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        // eslint-disable-next-line no-control-regex -- Business labels exclude control bytes and malformed Unicode.
        .regex(/^[^\u0000-\u001f\u007f-\u009f\ud800-\udfff]*$/u)
        .transform((value) => value || null)
        .nullish();
export const UtcDateTimeSchema = z.iso.datetime().describe('UTC ISO 8601 timestamp');
export const NulFreeTextSchema = z
    .string()
    // eslint-disable-next-line no-control-regex -- Allow multiline text while excluding NUL.
    .regex(/^[^\u0000]*$/u, 'Text must not contain NUL characters');
