export type Simplify<Type> = {
    [Key in keyof Type]: Type[Key];
} & {};
