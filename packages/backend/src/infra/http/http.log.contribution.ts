import type { LoggerContribution } from '@/platform/observability/logger/logger.contribution.js';
import * as pretty from './http.log.pretty.js';
import * as diagnostic from './http.log.diagnostic.js';

export const httpLogContribution = {
    id: 'http.gateway',
    diagnostic,
    pretty,
} satisfies LoggerContribution;
