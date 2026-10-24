import { z } from 'zod';
import {
    FacilitySchema,
    FacilityDetailSchema,
    StorageNodeSchema,
    StorageNodeDetailSchema,
} from '@talos-ark/contracts/facility';
import type {
    FacilityCapabilities,
    FacilityGrant,
    FacilityState,
    FacilityUpdate,
    FacilityWrite,
    StorageGrid,
    StorageNodeCreate,
    StorageNodeMove,
    StorageNodeReorder,
    StorageNodeState,
    StorageNodeUpdate,
} from '@talos-ark/contracts/facility';

export type FacilityScope = { organizationId: string; workspaceId?: string };
export type FacilityFact = { label: string; value: string | null };
export type FacilitySummary = z.infer<typeof FacilitySchema>;
export type FacilityQuery = {
    workspaceId?: string;
    q?: string;
    state?: 'active' | 'archived' | 'all';
    page: number;
    pageSize: number;
};
export type FacilityPage = {
    items: FacilitySummary[];
    total: number;
    page: number;
    pageSize: number;
};
export type FacilityDetail = z.infer<typeof FacilityDetailSchema>;
export type FacilityTopology = NonNullable<FacilityDetail['topology']>;
export type StorageScope = FacilityScope & { facilityId: string; topologyId: string };
export type StorageNode = z.infer<typeof StorageNodeSchema> & StorageScope;
export type StorageNodeDetail = z.infer<typeof StorageNodeDetailSchema>['node'] &
    StorageScope & {
        ancestors: { id: string; name: string; code: string | null }[];
        revision: number;
        capabilities: FacilityCapabilities;
    };
export type StorageNodePage = StorageScope & {
    parentId: string | null;
    items: StorageNode[];
    revision: number;
    nextCursor: string | null;
    hasNextPage: boolean;
};
export type FacilityMutation = { revision: number };
export type FacilityMoveResult = { sourceRevision: number; targetRevision: number };

export interface FacilityDataSource {
    governance(
        scope: FacilityScope,
        signal?: AbortSignal
    ): Promise<{ canCreate: boolean; canGovern: boolean; canInitialize: boolean }>;
    initialize(scope: FacilityScope, signal?: AbortSignal): Promise<{ updated: boolean }>;
    list(scope: FacilityScope, query: FacilityQuery, signal?: AbortSignal): Promise<FacilityPage>;
    detail(scope: FacilityScope, id: string, signal?: AbortSignal): Promise<FacilityDetail>;
    create(
        scope: FacilityScope,
        input: FacilityWrite,
        signal?: AbortSignal
    ): Promise<FacilitySummary>;
    update(
        scope: FacilityScope,
        id: string,
        input: FacilityUpdate,
        signal?: AbortSignal
    ): Promise<FacilitySummary>;
    state(
        scope: FacilityScope,
        id: string,
        input: FacilityState,
        signal?: AbortSignal
    ): Promise<FacilitySummary>;
    access(
        scope: FacilityScope,
        id: string,
        input: FacilityGrant,
        signal?: AbortSignal
    ): Promise<FacilityMutation>;
    children(
        scope: StorageScope,
        query: {
            parentId: string | null;
            cursor?: string;
            limit: number;
            q?: string;
            mode?: 'children' | 'search' | 'positions';
            state?: 'active' | 'archived' | 'all';
        },
        signal?: AbortSignal
    ): Promise<StorageNodePage>;
    node(scope: StorageScope, id: string, signal?: AbortSignal): Promise<StorageNodeDetail>;
    createNode(
        scope: StorageScope,
        input: StorageNodeCreate,
        signal?: AbortSignal
    ): Promise<StorageNodeDetail>;
    updateNode(
        scope: StorageScope,
        id: string,
        input: StorageNodeUpdate,
        signal?: AbortSignal
    ): Promise<StorageNodeDetail>;
    stateNode(
        scope: StorageScope,
        id: string,
        input: StorageNodeState,
        signal?: AbortSignal
    ): Promise<FacilityMutation>;
    moveNode(
        scope: StorageScope,
        id: string,
        input: StorageNodeMove,
        signal?: AbortSignal
    ): Promise<FacilityMoveResult>;
    reorderNode(
        scope: StorageScope,
        id: string,
        input: StorageNodeReorder,
        signal?: AbortSignal
    ): Promise<FacilityMutation>;
    generateGrid(
        scope: StorageScope,
        id: string,
        input: StorageGrid,
        signal?: AbortSignal
    ): Promise<FacilityMutation>;
}

export type FacilityRule = {
    id: string;
    name: string;
    scope: string;
    origin: string;
    facts: FacilityFact[];
};
export type FacilityTemplate = {
    id: string;
    name: string;
    version: string;
    nodeTypes: string[];
    status: string;
    updatedAt: string | null;
    description: string | null;
    structure: { id: string; parentId: string | null; name: string; type: string }[];
    facts: FacilityFact[];
};
export type FacilityGovernance = FacilityScope & {
    facilityId: string;
    measuredAt: string;
    rules: FacilityRule[] | null;
    templates: FacilityTemplate[] | null;
    complete: boolean;
    notes: string[];
};
export interface FacilityGovernanceDataSource {
    read(
        scope: FacilityScope,
        facilityId: string,
        signal: AbortSignal
    ): Promise<FacilityGovernance>;
}

export type { FacilityCapabilities };
