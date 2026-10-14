import 'reflect-metadata';
import type { ExtensionPoint } from '../extension.contract.js';
import { ExtensionError } from '../extension.error.js';

export const EXTENSION_MARKER = Symbol('extension:declared');
export const EXTENSION_DECLARATIONS = Symbol('extension:points');

export function createExtensionDecorator<M>(
    point: ExtensionPoint<M>
): (metadata: M) => ClassDecorator & MethodDecorator {
    return (metadata) =>
        (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
            if (key === undefined && typeof target === 'function') {
                declare(target, point, metadata);
                Reflect.defineMetadata(EXTENSION_MARKER, true, target);
                return;
            }
            if (
                typeof target === 'function' ||
                typeof key !== 'string' ||
                !descriptor ||
                typeof descriptor.value !== 'function'
            )
                throw new ExtensionError({ reason: 'target-unavailable', point: point.name });
            declare(descriptor.value, point, metadata);
            Reflect.defineMetadata(EXTENSION_MARKER, true, target.constructor);
        };
}

function declare<M>(target: object, point: ExtensionPoint<M>, metadata: M): void {
    if (Reflect.hasOwnMetadata(point.metadataKey, target))
        throw new ExtensionError({ reason: 'duplicate-key', point: point.name });
    const keys = (Reflect.getOwnMetadata(EXTENSION_DECLARATIONS, target) ??
        []) as readonly symbol[];
    Reflect.defineMetadata(point.metadataKey, metadata, target);
    Reflect.defineMetadata(
        EXTENSION_DECLARATIONS,
        Object.freeze([...keys, point.metadataKey]),
        target
    );
}
