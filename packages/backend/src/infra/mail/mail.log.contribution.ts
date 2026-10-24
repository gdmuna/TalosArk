import type { LoggerContribution } from '@/platform/observability/logger/logger.contribution.js';
import * as diagnostic from './mail.log.diagnostic.js';

export const mailLogContribution = { id: 'mail', diagnostic } satisfies LoggerContribution;
