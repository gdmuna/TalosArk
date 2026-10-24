import type { ApprovalLine } from '@talos-ark/contracts/approval';

export function approvalProgress(
    lines: readonly Pick<ApprovalLine, 'decision' | 'executionStatus'>[]
) {
    return {
        totalLines: lines.length,
        decisions: {
            approved: lines.filter((line) => line.decision === 'APPROVED').length,
            rejected: lines.filter((line) => line.decision === 'REJECTED').length,
        },
        executions: {
            pending: lines.filter((line) => line.executionStatus === 'PENDING').length,
            executed: lines.filter((line) => line.executionStatus === 'EXECUTED').length,
            abandoned: lines.filter((line) => line.executionStatus === 'ABANDONED').length,
            revoked: lines.filter((line) => line.executionStatus === 'REVOKED').length,
        },
    };
}

export function completeDecisionIds(
    expected: readonly string[],
    decisions: readonly { lineId: string }[]
) {
    const actual = new Set(decisions.map((line) => line.lineId));
    return (
        expected.length === decisions.length &&
        actual.size === decisions.length &&
        expected.every((id) => actual.has(id))
    );
}
