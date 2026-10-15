import type { LoggerContribution } from '../../observability/logger/logger.contribution.js';
import * as pretty from './performance.log.pretty.js';

export const performanceLogContribution = {
    id: 'http.performance',
    pretty,
} satisfies LoggerContribution;
