import { z } from 'zod';

export const UuidSchema = z.uuid();
export const UtcDateTimeSchema = z.iso.datetime().describe('UTC ISO 8601 timestamp');
