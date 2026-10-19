import type { ResourceDescriptor, ResourceKind } from '@/core/resource/index.js';
import type { FileActor, FileReferenceSnapshot } from '../file.contract.js';

export interface FilePurposeDefinition {
    readonly key: string;
    readonly resourceKind: ResourceKind;
    readonly maxSizeBytes: number;
    readonly formats: Readonly<Record<string, readonly string[]>>;
}

export interface FilePurposeAccess {
    readonly actor: FileActor;
    readonly resourceId: string;
    readonly mode: 'read' | 'manage';
}

export interface FilePurposeChange {
    readonly actor: FileActor;
    readonly resource: ResourceDescriptor;
    readonly reference: FileReferenceSnapshot;
    readonly action: 'bind' | 'unbind';
}

export interface FilePurposeProvider {
    authorize(input: FilePurposeAccess): Promise<ResourceDescriptor | null>;
    recordChange(input: FilePurposeChange): Promise<void>;
}

export interface RegisteredFilePurpose {
    readonly definition: FilePurposeDefinition;
    readonly provider: FilePurposeProvider;
}
