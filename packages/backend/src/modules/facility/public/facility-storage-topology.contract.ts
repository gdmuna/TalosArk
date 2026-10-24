export type StorageNodeKind = 'CONTAINER' | 'POSITION';

export type StorageNodeScope =
    | { readonly kind: 'none' }
    | {
          readonly kind: 'topology';
          readonly organizationId: string;
          readonly topologyId: string;
      }
    | {
          readonly kind: 'subtree';
          readonly organizationId: string;
          readonly topologyId: string;
          readonly rootNodeIds: readonly string[];
      };

export interface StorageNodeFact {
    readonly id: string;
    readonly organizationId: string;
    readonly topologyId: string;
    readonly resourceId: string;
    readonly parentId: string | null;
    readonly path: string;
    readonly code: string | null;
    readonly name: string;
    readonly kind: StorageNodeKind;
    readonly rowIndex: number | null;
    readonly columnIndex: number | null;
    readonly sortOrder: number;
    readonly archivedAt: Date | null;
}

export interface StorageNodeCursorPage<T> {
    readonly items: readonly T[];
    readonly nextCursor: string | null;
    readonly hasNextPage: boolean;
}

export interface StorageNodeLookup {
    readonly organizationId: string;
    readonly topologyId: string;
    readonly nodeId: string;
    readonly scope: StorageNodeScope;
}

export interface StorageNodeListInput {
    readonly organizationId: string;
    readonly topologyId: string;
    readonly scope: StorageNodeScope;
    readonly cursor?: string;
    readonly limit?: number;
}

export interface StorageNodeChildrenInput extends StorageNodeListInput {
    readonly parentId: string | null;
}

export interface StorageNodeDescendantsInput extends StorageNodeListInput {
    readonly rootNodeId: string;
}

export interface StorageNodeMutationInput {
    readonly id: string;
    readonly organizationId: string;
    readonly topologyId: string;
    readonly resourceId: string;
    readonly parentId: string | null;
    readonly code?: string | null;
    readonly name: string;
    readonly kind: StorageNodeKind;
    readonly containerType?:
        | 'FREEZER'
        | 'LIQUID_NITROGEN_TANK'
        | 'CABINET'
        | 'SHELF'
        | 'RACK'
        | 'DRAWER'
        | 'BOX'
        | 'PARTITION'
        | 'OTHER';
    readonly description?: string;
    readonly rowCount?: number;
    readonly columnCount?: number;
    readonly rowIndex?: number;
    readonly columnIndex?: number;
    readonly sortOrder?: number;
}

export interface StorageNodeMoveInput {
    readonly organizationId: string;
    readonly topologyId: string;
    readonly targetTopologyId: string;
    readonly nodeId: string;
    readonly parentId: string | null;
    readonly code?: string | null;
    readonly rowIndex?: number;
    readonly columnIndex?: number;
}
