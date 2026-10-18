import type {
    StorageNodeChildrenInput,
    StorageNodeCursorPage,
    StorageNodeDescendantsInput,
    StorageNodeFact,
    StorageNodeLookup,
} from './facility-storage-topology.contract.js';

export abstract class FacilityStorageTopologyReader {
    abstract findNode(input: StorageNodeLookup): Promise<StorageNodeFact | null>;
    abstract listChildren(
        input: StorageNodeChildrenInput
    ): Promise<StorageNodeCursorPage<StorageNodeFact>>;
    abstract listDescendants(
        input: StorageNodeDescendantsInput
    ): Promise<StorageNodeCursorPage<StorageNodeFact>>;
    abstract listAncestors(input: StorageNodeLookup): Promise<readonly StorageNodeFact[]>;
}
