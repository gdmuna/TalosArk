import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { ResourceProviderRegistry } from './resource-provider.registry.js';
import type { CreateResourceIdentity } from './resource-identity.js';
import type { ResourceLookup } from './resource-provider.js';
import { parseResourceDescriptor, type ResourceDescriptor } from './resource-descriptor.js';
import { ResourceError } from './resource.error.js';
import { parseCreateResource, parseResourceLookup } from './internal/resource.input.js';

function containsScope(
    expected: ResourceLookup['expectedScope'],
    actual: ResourceDescriptor['scope']
): boolean {
    if (!expected) return true;
    if (expected.organizationId !== actual.organizationId) return false;
    return expected.kind === 'organization'
        ? true
        : actual.kind === 'workspace' && expected.workspaceId === actual.workspaceId;
}

@Injectable()
export class ResourceKernel {
    constructor(
        private readonly database: DatabaseRuntime,
        private readonly providers: ResourceProviderRegistry
    ) {}

    create(input: CreateResourceIdentity): Promise<{ id: string }> {
        const value = parseCreateResource(input);
        return this.database.transaction.run(
            async () => {
                this.providers.require(value.kind);
                return this.database.queryClient.resourceIdentity.create({
                    data: { organizationId: value.organizationId, kind: value.kind },
                    select: { id: true },
                });
            },
            { propagation: 'mandatory' }
        );
    }

    /** Homogeneous identities; returned IDs have no input ordering semantics. */
    createBatch(input: CreateResourceIdentity, count: number): Promise<{ id: string }[]> {
        return this.database.transaction.run(
            async () => {
                if (!Number.isInteger(count) || count < 1 || count > 1000)
                    throw new ResourceError({ reason: 'invalid-input' });
                const value = parseCreateResource(input);
                this.providers.require(value.kind);
                return this.database.queryClient.resourceIdentity.createManyAndReturn({
                    data: Array.from({ length: count }, () => ({ ...value })),
                    select: { id: true },
                });
            },
            { propagation: 'mandatory' }
        );
    }

    describe(input: ResourceLookup): Promise<ResourceDescriptor | null> {
        const value = parseResourceLookup(input);
        return this.database.transaction.run(
            async () => {
                const identity = await this.database.queryClient.resourceIdentity.findUnique({
                    where: { id: value.resourceId },
                    select: { kind: true, organizationId: true },
                });
                if (!identity) return null;
                const provided = await this.providers.require(identity.kind).describe(value);
                if (!provided) return null;
                const descriptor = parseResourceDescriptor(provided);
                if (
                    descriptor.resourceId !== value.resourceId ||
                    descriptor.kind !== identity.kind ||
                    descriptor.scope.organizationId !== identity.organizationId ||
                    !containsScope(value.expectedScope, descriptor.scope)
                )
                    throw new ResourceError({ reason: 'invalid-descriptor', kind: identity.kind });
                return Object.freeze({
                    ...descriptor,
                    scope: Object.freeze({ ...descriptor.scope }),
                });
            },
            this.database.transaction.current()
                ? { propagation: 'mandatory' }
                : { isolationLevel: 'RepeatableRead' }
        );
    }
}
