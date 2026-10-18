import type { PermissionScope, PermissionSubject } from '@/core/permission/index.js';
import type { ResourceDescriptor } from './resource-descriptor.js';

export interface ResourceLookup {
    readonly resourceId: string;
    readonly subject: PermissionSubject;
    readonly expectedScope?: PermissionScope;
}

export interface ResourceProvider {
    describe(input: ResourceLookup): Promise<ResourceDescriptor | null>;
}
