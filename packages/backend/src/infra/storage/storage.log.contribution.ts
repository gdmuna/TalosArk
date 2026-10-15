import type { LoggerContribution } from '@/platform/observability/logger/logger.contribution.js';
import * as diagnostic from './storage.log.diagnostic.js';

export const storageLogContribution = { id: 'storage', diagnostic } satisfies LoggerContribution;
