import type { LoggerContribution } from '@/platform/observability/logger/logger.contribution.js';
import * as diagnostic from './iam.log.diagnostic.js';

export const iamLogContribution = { id: 'iam', diagnostic } satisfies LoggerContribution;
