import { assertPageResponseMatches, HttpError } from '@/platform/http';
import type {
    FacilityScope,
    FacilityQuery,
    FacilityPage,
    FacilityDetail,
    StorageScope,
    StorageNode,
} from './source';

export function assertFacilityScope(scope: FacilityScope, result: FacilityScope) {
    if (scope.organizationId !== result.organizationId)
        throw new HttpError('设施响应组织不匹配', 'protocol');
}
export function assertFacilityPage(
    scope: FacilityScope,
    query: FacilityQuery,
    result: FacilityPage
) {
    result.items.forEach((item) => assertFacilityScope(scope, item));
    const errorMessage = '设施列表分页无效';
    assertPageResponseMatches(query, result, errorMessage);
    if (!Number.isSafeInteger(result.total) || result.items.some((item) => !item.id))
        throw new HttpError(errorMessage, 'protocol');
}
export function assertFacilityDetail(scope: FacilityScope, id: string, result: FacilityDetail) {
    assertFacilityScope(scope, result);
    if (result.id !== id) throw new HttpError('设施响应身份无效', 'protocol');
}
export function assertStorageScope(scope: StorageScope, result: StorageScope) {
    assertFacilityScope(scope, result);
    if (scope.facilityId !== result.facilityId || scope.topologyId !== result.topologyId)
        throw new HttpError('存储响应范围不匹配', 'protocol');
}
export function assertStorageNode(scope: StorageScope, node: StorageNode) {
    assertStorageScope(scope, node);
    if (
        !node.id ||
        (node.kind !== 'CONTAINER' && node.kind !== 'POSITION') ||
        (node.kind === 'POSITION' && node.hasChildren) ||
        (node.rowIndex === null) !== (node.columnIndex === null) ||
        (node.rowCount === null) !== (node.columnCount === null)
    )
        throw new HttpError('存储节点响应无效', 'protocol');
}
