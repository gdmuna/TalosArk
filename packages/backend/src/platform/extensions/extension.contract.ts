export type ExtensionSource =
    | { readonly kind: 'explicit'; readonly owner: string }
    | { readonly kind: 'provider'; readonly owner: string; readonly provider: string }
    | {
          readonly kind: 'method';
          readonly owner: string;
          readonly provider: string;
          readonly method: string;
      };

export interface ExtensionEntry<K extends string = string, V = unknown> {
    readonly key: K;
    readonly value: V;
    readonly source: ExtensionSource;
}

type ValueAt<E extends ExtensionEntry, K extends string> = E extends ExtensionEntry
    ? K extends E['key']
        ? E['value']
        : never
    : never;

export interface ExtensionIndex<E extends ExtensionEntry> {
    require<K extends E['key']>(key: K): ValueAt<E, K>;
    find(key: string): E['value'] | undefined;
    entries(): readonly ExtensionEntry<E['key'], E['value']>[];
}

declare const metadataType: unique symbol;

export interface ExtensionPoint<M> {
    readonly name: string;
    readonly metadataKey: symbol;
    readonly [metadataType]?: (metadata: M) => M;
}
