import { defineExtensionPoint } from '../../extensions/index.js';
import { createExtensionDecorator } from '../../extensions/discovery/index.js';
import type { LoggerContribution } from './logger.contribution.js';

export const loggerPoint = defineExtensionPoint<LoggerContribution>('observability.logger');
const declare = createExtensionDecorator(loggerPoint);

export const LoggerExtension = (contribution: LoggerContribution): ClassDecorator =>
    declare(contribution);
