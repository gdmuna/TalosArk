export type SeedDatabaseRequirement =
    | { readonly type: 'table'; readonly schema: string; readonly name: string }
    | { readonly type: 'extension'; readonly name: string }
    | {
          readonly type: 'constraint' | 'trigger';
          readonly schema: string;
          readonly table: string;
          readonly name: string;
      }
    | { readonly type: 'function'; readonly signature: string };

export interface SeedDatabaseDeclaration {
    readonly kindId: string;
    readonly requires: readonly SeedDatabaseRequirement[];
    readonly hint: string;
}

export interface SeedDatabaseCheck {
    readonly requirement: SeedDatabaseRequirement;
    readonly usedBy: readonly { readonly step: string; readonly hint: string }[];
}

export function databaseTables(...names: string[]): SeedDatabaseRequirement[] {
    return names.map((name) => ({ type: 'table', schema: 'public', name }));
}
