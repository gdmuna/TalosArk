import { z } from 'zod';

export const UuidSchema = z.uuid();
export const UtcDateTimeSchema = z.iso.datetime().describe('UTC ISO 8601 timestamp');
export const NulFreeTextSchema = z
    .string()
    // eslint-disable-next-line no-control-regex -- Allow multiline text while excluding NUL.
    .regex(/^[^\u0000]*$/u, 'Text must not contain NUL characters');
