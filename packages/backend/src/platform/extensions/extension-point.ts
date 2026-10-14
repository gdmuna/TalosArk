import type { ExtensionPoint } from './extension.contract.js';
import { assertExtensionLabel } from './extension-index.js';

export function defineExtensionPoint<M>(name: string): ExtensionPoint<M> {
    assertExtensionLabel(name);
    return Object.freeze({ name, metadataKey: Symbol(name) });
}
