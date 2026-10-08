import type { Component } from 'vue';
import type { LocationQuery, RouteParamsGeneric } from 'vue-router';

export type RouteTabContextEntity<T = unknown> = {
    id: string;
    value: T;
};

export type TabContextEntity = {
    id: string;
    // title: string;
    // scroll: {
    //     x: number
    //     y: number
    // }
    createAt: Date;
};

export type TabContextCreateOpts = Partial<
    TabContextEntity & {
        afterIdx: number;
    }
>;

export type TabComponentContextEntity = {
    tabId: string;
    path: string;
    component: Component;
};

export type TabComponentContextState = 'idle' | 'switching';

export type TabCustomContextNamespace = {
    navigation: { path: string; canGoBack: boolean; canForward: boolean };
    session: { visits: number; lastAccess: Date };
};

export type TabCustomContextStore = Map<
    string,
    {
        [Ns in keyof TabCustomContextNamespace]?: TabCustomContextNamespace[Ns];
    }
>;

export type TabCustomContextNamespaceKey = keyof TabCustomContextNamespace;

export type ViewHistoryEntry = {
    contextId: string;
    path: string;
    fullPath: string;
    params?: RouteParamsGeneric;
    query?: LocationQuery;
    hash?: string;
    title: string;
};

export type ViewHistoryEntryOpts = Omit<ViewHistoryEntry, 'contextId'>;

export type ViewHistoryEntity = {
    entry: ViewHistoryEntry[];
    cursor: number;
    navigationPending: boolean;
};

export type SlotContextEntity = {
    id: string;
    tabId: string | null;
    component: Component;
    order: number | string;
    enable: boolean;
    stable: boolean;
    keepAlive: boolean;
};
