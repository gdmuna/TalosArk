import * as c from '@talos-ark/contracts/approval';
import { assertPageResponseMatches, HttpError, type HttpClient } from '@/platform/http';
import { approvalMutationSchema, type ApprovalDataSource } from './source';
const root = (scope: c.ApprovalScope) =>
    `/organization/${encodeURIComponent(scope.organizationId)}/workspace/${encodeURIComponent(scope.workspaceId)}/approval`;
function checkRequest(scope: c.ApprovalScope, row: c.ApprovalRequest, id?: string) {
    if (
        row.organizationId !== scope.organizationId ||
        row.workspaceId !== scope.workspaceId ||
        (id && row.id !== id)
    )
        throw new HttpError('申请范围或身份不一致', 'protocol');
}
export function createHttpApprovalDataSource(http: HttpClient): ApprovalDataSource {
    return {
        context: (scope, signal) =>
            http.request({
                method: 'GET',
                path: `${root(scope)}/context`,
                schema: c.ApprovalContextSchema,
                signal,
                retry: false,
            }),
        summary: (scope, signal) =>
            http.request({
                method: 'GET',
                path: `${root(scope)}/summary`,
                schema: c.ApprovalSummarySchema,
                signal,
                retry: false,
            }),
        candidates: (scope, body, signal) =>
            http.request({
                method: 'POST',
                path: `${root(scope)}/approver/query`,
                body: c.ApprovalSelectionSchema.parse(body),
                schema: c.ApprovalCandidatePageSchema,
                signal,
                retry: false,
            }),
        async list(scope, query, signal) {
            const params = c.ApprovalQuerySchema.parse(query);
            const result = await http.request({
                method: 'GET',
                path: root(scope),
                params,
                schema: c.ApprovalRequestPageSchema,
                signal,
                retry: false,
            });
            assertPageResponseMatches(params, result, '申请分页不一致');
            result.items.forEach((row) => checkRequest(scope, row));
            return result;
        },
        async get(scope, id, signal) {
            const row = await http.request({
                method: 'GET',
                path: `${root(scope)}/${encodeURIComponent(id)}`,
                schema: c.ApprovalRequestSchema,
                signal,
                retry: false,
            });
            checkRequest(scope, row, id);
            return row;
        },
        async lines(scope, id, query, signal) {
            const params = c.ApprovalPageQuerySchema.parse(query);
            const result = await http.request({
                method: 'GET',
                path: `${root(scope)}/${encodeURIComponent(id)}/line`,
                params,
                schema: c.ApprovalLinePageSchema,
                signal,
                retry: false,
            });
            assertPageResponseMatches(params, result, '申请明细分页不一致');
            if (
                result.items.some(
                    (line, index) =>
                        line.lineNumber !== (params.page - 1) * params.pageSize + index + 1
                )
            )
                throw new HttpError('申请明细行序不一致', 'protocol');
            return result;
        },
        async events(scope, id, query, signal) {
            const params = c.ApprovalPageQuerySchema.parse(query);
            const result = await http.request({
                method: 'GET',
                path: `${root(scope)}/${encodeURIComponent(id)}/event`,
                params,
                schema: c.ApprovalEventPageSchema,
                signal,
                retry: false,
            });
            assertPageResponseMatches(params, result, '审批历史分页不一致');
            return result;
        },
        async mutate(scope, value, signal) {
            const mutation = approvalMutationSchema.parse(value);
            const path =
                mutation.kind === 'submit'
                    ? root(scope)
                    : `${root(scope)}/${encodeURIComponent(mutation.requestId)}/${'lineId' in mutation ? `line/${encodeURIComponent(mutation.lineId)}/` : ''}${mutation.kind === 'decide' ? 'decision' : mutation.kind}`;
            if (mutation.kind === 'execute') {
                const receipt = await http.request({
                    method: 'POST',
                    path,
                    body: mutation.body,
                    schema: c.ApprovalExecutionReceiptSchema,
                    signal,
                    retry: false,
                });
                if (receipt.requestId !== mutation.requestId || receipt.lineId !== mutation.lineId)
                    throw new HttpError('执行回执身份不一致', 'protocol');
                return { kind: 'inventory', receipt };
            }
            const receipt = await http.request({
                method: 'POST',
                path,
                body: mutation.body,
                schema: c.ApprovalReceiptSchema,
                signal,
                retry: false,
            });
            if (
                receipt.kind !== `approval.${mutation.kind}` ||
                ('requestId' in mutation && receipt.requestId !== mutation.requestId) ||
                ('lineId' in mutation && receipt.lineId !== mutation.lineId)
            )
                throw new HttpError('审批回执身份不一致', 'protocol');
            return { kind: 'approval', receipt };
        },
        async operation(scope, id, signal) {
            const result = await http.request({
                method: 'GET',
                path: `${root(scope)}/operation/${encodeURIComponent(id)}`,
                schema: c.ApprovalOperationResultSchema,
                signal,
                retry: false,
            });
            const actual =
                result.kind === 'approval'
                    ? result.receipt.operationId
                    : result.receipt.receipt.operationId;
            if (actual !== id) throw new HttpError('审批操作身份不一致', 'protocol');
            return result;
        },
    };
}
