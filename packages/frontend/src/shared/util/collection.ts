export type MaybeArray<T> = T | readonly T[];

export function asArray<T>(value: MaybeArray<T>): readonly T[] {
    return Array.isArray(value) ? value : ([value] as readonly T[]);
}
