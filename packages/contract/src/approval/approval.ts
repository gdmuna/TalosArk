import { z } from 'zod';
import { InventoryText } from '../material/batch.js';
import {
    InventoryScopeSchema,
    LocationSchema,
    OperationReceiptSchema,
    QuantitySchema,
} from '../inventory/inventory.js';

const id = z.uuid().toLowerCase();
const revision = z.number().int().positive();
const key = z.string().regex(/^[\x21-\x7e]{1,255}$/);
const note = InventoryText(1000).default('');
export const ApprovalScopeSchema = InventoryScopeSchema;
export const ApprovalParamsSchema = ApprovalScopeSchema.extend({ requestId: id });
export const ApprovalLineParamsSchema = ApprovalParamsSchema.extend({ lineId: id });
export const ApprovalOperationParamsSchema = ApprovalScopeSchema.extend({ operationId: id });
export const ApprovalTypeSchema = z.enum(['CONSUME', 'TRANSFER']);
const intent = z.discriminatedUnion('type', [
    z.strictObject({
        type: z.literal('CONSUME'),
        stockItemId: id,
        quantity: QuantitySchema.refine((value) => /[1-9]/.test(value)),
        note,
    }),
    z.strictObject({
        type: z.literal('TRANSFER'),
        stockItemId: id,
        destination: z.strictObject({ facilityId: id, topologyId: id, nodeId: id }),
        note,
    }),
]);
const selection = z
    .strictObject({
        type: ApprovalTypeSchema,
        lines: z.array(intent).min(1),
    })
    .superRefine((value, ctx) => {
        if (
            value.lines.some((line) => line.type !== value.type) ||
            new Set(value.lines.map((line) => line.stockItemId)).size !== value.lines.length
        )
            ctx.addIssue({
                code: 'custom',
                message: 'Each physical item must occur once under the same action',
            });
    });
export const ApprovalSelectionSchema = selection;
export const ApprovalSubmitSchema = selection.safeExtend({
    approverId: id,
    title: InventoryText(200).default(''),
    description: InventoryText(4000).default(''),
    previousId: id.optional(),
    idempotencyKey: key,
});
export const ApprovalCommandSchema = z.strictObject({
    expectedVersion: revision,
    idempotencyKey: key,
    note,
});
export const ApprovalDecisionSchema = ApprovalCommandSchema.extend({
    lines: z
        .array(
            z.strictObject({
                lineId: id,
                decision: z.enum(['APPROVED', 'REJECTED']),
                opinion: note,
            })
        )
        .min(1),
});
// Intent and quantity always come from the approved line, never from this body.
export const ApprovalExecuteSchema = z.strictObject({
    expectedVersion: revision,
    idempotencyKey: key,
});
export const ApprovalPageQuerySchema = z.strictObject({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export const ApprovalQuerySchema = ApprovalPageQuerySchema.extend({
    view: z.enum(['mine', 'review', 'execute', 'all']).default('mine'),
    status: z.enum(['PENDING', 'DECIDED', 'WITHDRAWN']).optional(),
});
export const ApprovalCapabilitiesSchema = z.object({
    consumeApply: z.boolean(),
    transferApply: z.boolean(),
    consumeReview: z.boolean(),
    transferReview: z.boolean(),
    readAll: z.boolean(),
    revoke: z.boolean(),
});
export const ApprovalContextSchema = z.object({ capabilities: ApprovalCapabilitiesSchema });
export const ApprovalCandidateSchema = z.object({
    userId: id,
    username: z.string(),
    name: z.string(),
});
export const ApprovalCandidatePageSchema = z.object({ items: z.array(ApprovalCandidateSchema) });
export const ApprovalReceiptSchema = z.object({
    operationId: id,
    requestId: id,
    lineId: id.nullable(),
    kind: z.enum([
        'approval.submit',
        'approval.decide',
        'approval.withdraw',
        'approval.abandon',
        'approval.revoke',
    ]),
});
export const ApprovalExecutionReceiptSchema = z.object({
    requestId: id,
    lineId: id,
    receipt: OperationReceiptSchema,
});
export const ApprovalOperationResultSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('approval'), receipt: ApprovalReceiptSchema }),
    z.object({ kind: z.literal('inventory'), receipt: ApprovalExecutionReceiptSchema }),
]);
export const ApprovalRequestSchema = z.object({
    id,
    resourceId: id,
    organizationId: id,
    workspaceId: id,
    type: ApprovalTypeSchema,
    title: z.string(),
    description: z.string(),
    requesterId: id,
    approverId: id,
    requesterName: z.string(),
    approverName: z.string(),
    previousId: id.nullable(),
    status: z.enum(['PENDING', 'DECIDED', 'WITHDRAWN']),
    version: revision,
    createdAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
    totalLines: z.number().int().nonnegative(),
    decisions: z.object({
        approved: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
    }),
    executions: z.object({
        pending: z.number().int().nonnegative(),
        executed: z.number().int().nonnegative(),
        abandoned: z.number().int().nonnegative(),
        revoked: z.number().int().nonnegative(),
    }),
    actions: z.object({ decide: z.boolean(), withdraw: z.boolean() }),
});
export const ApprovalLineSchema = z.object({
    id,
    lineNumber: revision,
    version: revision,
    decision: z.enum(['UNDECIDED', 'APPROVED', 'REJECTED']),
    opinion: z.string(),
    executionStatus: z.enum(['PENDING', 'EXECUTED', 'ABANDONED', 'REVOKED']).nullable(),
    terminalAt: z.iso.datetime().nullable(),
    // Null hides current and historical resource data after loss of read authority.
    stock: z
        .object({
            stockItemId: id,
            instanceId: id,
            code: z.string(),
            materialName: z.string(),
            quantity: QuantitySchema,
            quantityUnit: z.string(),
            quantityScale: z.number().int(),
        })
        .nullable(),
    requestedQuantity: QuantitySchema.nullable(),
    source: LocationSchema.nullable(),
    destination: LocationSchema.nullable(),
    locationRestricted: z.boolean(),
    note: z.string(),
    operationId: id.nullable(),
    transactionId: id.nullable(),
    blockedReason: z.string().nullable(),
    actions: z.object({ execute: z.boolean(), abandon: z.boolean(), revoke: z.boolean() }),
});
export const ApprovalRequestPageSchema = z.object({
    items: z.array(ApprovalRequestSchema),
    total: z.number().int().nonnegative(),
    page: revision,
    pageSize: revision,
});
export const ApprovalLinePageSchema = z.object({
    items: z.array(ApprovalLineSchema),
    total: z.number().int().nonnegative(),
    page: revision,
    pageSize: revision,
});
export const ApprovalSummarySchema = z.object({
    pendingReview: z.number().int().nonnegative(),
    pendingExecution: z.number().int().nonnegative(),
});
export const ApprovalEventPageSchema = z.object({
    items: z.array(
        z.object({
            id,
            lineId: id.nullable(),
            actorUserId: id,
            actorName: z.string(),
            action: z.enum([
                'SUBMITTED',
                'DECIDED',
                'WITHDRAWN',
                'ABANDONED',
                'REVOKED',
                'EXECUTED',
            ]),
            occurredAt: z.iso.datetime(),
            note: z.string(),
        })
    ),
    total: z.number().int().nonnegative(),
    page: revision,
    pageSize: revision,
});

export type ApprovalScope = z.infer<typeof ApprovalScopeSchema>;
export type ApprovalType = z.infer<typeof ApprovalTypeSchema>;
export type ApprovalSelection = z.infer<typeof ApprovalSelectionSchema>;
export type ApprovalSubmit = z.infer<typeof ApprovalSubmitSchema>;
export type ApprovalCommand = z.infer<typeof ApprovalCommandSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type ApprovalExecute = z.infer<typeof ApprovalExecuteSchema>;
export type ApprovalQuery = z.infer<typeof ApprovalQuerySchema>;
export type ApprovalPageQuery = z.infer<typeof ApprovalPageQuerySchema>;
export type ApprovalReceipt = z.infer<typeof ApprovalReceiptSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type ApprovalLine = z.infer<typeof ApprovalLineSchema>;
export type ApprovalContext = z.infer<typeof ApprovalContextSchema>;
export type ApprovalSummary = z.infer<typeof ApprovalSummarySchema>;
export type ApprovalCandidate = z.infer<typeof ApprovalCandidateSchema>;
export type ApprovalRequestPage = z.infer<typeof ApprovalRequestPageSchema>;
export type ApprovalLinePage = z.infer<typeof ApprovalLinePageSchema>;
export type ApprovalEventPage = z.infer<typeof ApprovalEventPageSchema>;
export type ApprovalOperationResult = z.infer<typeof ApprovalOperationResultSchema>;
