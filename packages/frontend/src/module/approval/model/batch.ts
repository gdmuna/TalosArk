import type { ApprovalLine, ApprovalRequest, ApprovalScope } from '@talos-ark/contracts/approval';
import { batchLimit } from '@/component/batch-operation';
import { HttpError } from '@/platform/http';
import type { ApprovalDataSource, ApprovalMutation } from '../data/source';

export type ApprovalBatchSelection =
    | { kind: 'decide'; requestIds: string[]; decision: 'APPROVED' | 'REJECTED' }
    | { kind: 'execute'; requestId: string; lineIds: string[] };
export type ApprovalBatchPreview = { request: ApprovalRequest; lines: ApprovalLine[] };

export async function prepareApprovalBatch(
    source: ApprovalDataSource,
    scope: ApprovalScope,
    selection: ApprovalBatchSelection,
    signal: AbortSignal
): Promise<ApprovalBatchPreview[]> {
    const ids = selection.kind === 'decide' ? selection.requestIds : selection.lineIds;
    if (!ids.length || ids.length > batchLimit || new Set(ids).size !== ids.length)
        throw new Error('每批应选择 1 至 100 个不同的项目');
    const result: ApprovalBatchPreview[] = [];
    for (const id of selection.kind === 'decide' ? selection.requestIds : [selection.requestId]) {
        const request = await source.get(scope, id, signal);
        if (selection.kind === 'decide' && !request.actions.decide)
            throw new Error('部分申请已不可审核，请重新选择');
        const lines: ApprovalLine[] = [];
        for (let page = 1; ; page++) {
            const value = await source.lines(scope, id, { page, pageSize: 100 }, signal);
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            if (
                value.total !== request.totalLines ||
                (!value.items.length && lines.length < value.total)
            )
                throw new HttpError('申请明细不完整', 'protocol');
            lines.push(...value.items);
            if (lines.length >= value.total) break;
        }
        if (
            lines.length !== request.totalLines ||
            new Set(lines.map((line) => line.id)).size !== lines.length
        )
            throw new HttpError('申请明细不完整', 'protocol');
        const selected =
            selection.kind === 'execute' ? lines.filter((line) => ids.includes(line.id)) : lines;
        if (
            selection.kind === 'execute' &&
            (selected.length !== ids.length || selected.some((line) => !line.actions.execute))
        )
            throw new Error('部分明细已不可执行，请重新选择');
        result.push({ request, lines: selected });
    }
    return result;
}

type BatchCommand = {
    id: string;
    label: string;
    mutation: Extract<ApprovalMutation, { kind: 'decide' | 'execute' }>;
};
export function approvalBatchCommands(
    preview: ApprovalBatchPreview[],
    selection: ApprovalBatchSelection,
    note: string
): BatchCommand[] {
    return preview.flatMap<BatchCommand>(({ request, lines }) => {
        if (selection.kind === 'decide')
            return [
                {
                    id: crypto.randomUUID(),
                    label: request.title,
                    mutation: {
                        kind: 'decide',
                        requestId: request.id,
                        body: {
                            expectedVersion: request.version,
                            idempotencyKey: crypto.randomUUID(),
                            note,
                            lines: lines.map((line) => ({
                                lineId: line.id,
                                decision: selection.decision,
                                opinion: '',
                            })),
                        },
                    },
                },
            ];
        return lines.map((line) => ({
            id: crypto.randomUUID(),
            label: `${request.title} · ${line.stock?.code ?? line.lineNumber}`,
            mutation: {
                kind: 'execute',
                requestId: request.id,
                lineId: line.id,
                body: { expectedVersion: line.version, idempotencyKey: crypto.randomUUID() },
            },
        }));
    });
}
