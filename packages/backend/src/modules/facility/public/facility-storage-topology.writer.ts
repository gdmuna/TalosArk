import type {
    StorageNodeMoveInput,
    StorageNodeMutationInput,
} from './facility-storage-topology.contract.js';

export abstract class FacilityStorageTopologyWriter {
    abstract create(input: StorageNodeMutationInput): Promise<void>;
    abstract move(input: StorageNodeMoveInput): Promise<void>;
}
