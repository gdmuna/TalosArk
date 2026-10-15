import type { LoggerContribution } from '@/platform/observability/logger/logger.contribution.js';
import * as diagnostic from './kvs.log.diagnostic.js';
import * as pretty from './kvs.log.pretty.js';

export const kvsLogContribution = { id: 'kvs', diagnostic, pretty } satisfies LoggerContribution;
