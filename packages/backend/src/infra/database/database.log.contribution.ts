import type { LoggerContribution } from '@/platform/observability/logger/logger.contribution.js';
import * as pretty from './database.log.pretty.js';

export const databaseLogContribution = { id: 'database', pretty } satisfies LoggerContribution;
