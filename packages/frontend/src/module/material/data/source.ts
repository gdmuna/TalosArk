import type {
    Material,
    MaterialScope,
    MaterialQuery,
    MaterialPage,
    MaterialOverview,
    MaterialDetail,
    MaterialTypeList,
    MaterialType,
    MaterialTypeWrite,
    MaterialWrite,
} from '@talos-ark/contracts/material';

export interface MaterialDataSource {
    list(scope: MaterialScope, query: MaterialQuery, signal?: AbortSignal): Promise<MaterialPage>;
    overview(scope: MaterialScope, signal?: AbortSignal): Promise<MaterialOverview>;
    get(scope: MaterialScope, id: string, signal?: AbortSignal): Promise<MaterialDetail>;
    types(scope: MaterialScope, signal?: AbortSignal): Promise<MaterialTypeList>;
    create(scope: MaterialScope, input: MaterialWrite, signal?: AbortSignal): Promise<Material>;
    update(
        scope: MaterialScope,
        id: string,
        input: MaterialWrite,
        signal?: AbortSignal
    ): Promise<Material>;
    archive(
        scope: MaterialScope,
        id: string,
        archived: boolean,
        signal?: AbortSignal
    ): Promise<Material>;
    createType(
        scope: MaterialScope,
        input: MaterialTypeWrite,
        signal?: AbortSignal
    ): Promise<MaterialType>;
    updateType(
        scope: MaterialScope,
        id: string,
        input: MaterialTypeWrite,
        signal?: AbortSignal
    ): Promise<MaterialType>;
    archiveType(
        scope: MaterialScope,
        id: string,
        archived: boolean,
        signal?: AbortSignal
    ): Promise<MaterialType>;
}
