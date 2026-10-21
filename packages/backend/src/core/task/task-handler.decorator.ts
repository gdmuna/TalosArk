import { defineExtensionPoint } from '@/platform/extensions/index.js';
import { createExtensionDecorator } from '@/platform/extensions/discovery/index.js';
import type { TaskDefinition } from './task.types.js';

export const taskHandlerPoint = defineExtensionPoint<TaskDefinition>('task.handler');
export const TaskHandlerExtension: (definition: TaskDefinition) => ClassDecorator =
    createExtensionDecorator(taskHandlerPoint);
