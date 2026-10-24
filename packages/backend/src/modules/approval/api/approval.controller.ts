import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import * as c from '@talos-ark/contracts/approval';
import {
    ApprovalErrorDefinition,
    InventoryErrorDefinition,
    MaterialErrorDefinition,
    FacilityErrorDefinition,
    TeamErrorDefinition,
} from '@talos-ark/contracts/backend';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { ApprovalService } from '../application/approval.service.js';
import { ApprovalQueryService } from '../application/approval-query.service.js';
import { ApprovalExecutionService } from '../application/approval-execution.service.js';
import { ApprovalGovernanceService } from '../application/approval-governance.service.js';
const errors = [
    ...Object.values(ApprovalErrorDefinition),
    ...Object.values(InventoryErrorDefinition),
    ...Object.values(MaterialErrorDefinition),
    ...Object.values(FacilityErrorDefinition),
    TeamErrorDefinition.forbidden,
];
type RequestParams = z.infer<typeof c.ApprovalParamsSchema>;
type LineParams = z.infer<typeof c.ApprovalLineParamsSchema>;
type OperationParams = z.infer<typeof c.ApprovalOperationParamsSchema>;
function scope(params: c.ApprovalScope): c.ApprovalScope {
    return { organizationId: params.organizationId, workspaceId: params.workspaceId };
}

const organizationParams = z.strictObject({ organizationId: z.uuid().toLowerCase() });
@Controller('organization/:organizationId/approval')
export class ApprovalGovernanceController {
    constructor(private readonly governance: ApprovalGovernanceService) {}
    @Post('initialize')
    @ApiRoute({
        auth: 'required',
        summary: 'Explicitly initialize approval grants for existing workspace managers',
        request: { params: organizationParams },
        responses: [{ status: 200, schema: z.object({ updated: z.boolean() }) }],
        errors,
    })
    initialize(
        @Param() params: z.infer<typeof organizationParams>,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.governance.initialize(params.organizationId);
    }
}

@Controller('organization/:organizationId/workspace/:workspaceId/approval')
export class ApprovalController {
    constructor(
        private readonly approval: ApprovalService,
        private readonly query: ApprovalQueryService,
        private readonly execution: ApprovalExecutionService
    ) {}
    @Get('context')
    @ApiRoute({
        auth: 'required',
        summary: 'Read approval capabilities',
        request: { params: c.ApprovalScopeSchema },
        responses: [{ status: 200, schema: c.ApprovalContextSchema }],
        errors,
    })
    context(@Param() p: c.ApprovalScope, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.query.context(scope(p));
    }
    @Post('approver/query')
    @ApiRoute({
        auth: 'required',
        summary: 'Find qualified reviewers for the complete selected intent',
        request: { params: c.ApprovalScopeSchema, body: c.ApprovalSelectionSchema },
        responses: [{ status: 200, schema: c.ApprovalCandidatePageSchema }],
        errors,
    })
    candidates(
        @Param() p: c.ApprovalScope,
        @Body() body: c.ApprovalSelection,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.query.candidates(scope(p), body);
    }
    @Get('summary')
    @ApiRoute({
        auth: 'required',
        summary: 'Count assigned pending requests and pending approved lines',
        request: { params: c.ApprovalScopeSchema },
        responses: [{ status: 200, schema: c.ApprovalSummarySchema }],
        errors,
    })
    summary(@Param() p: c.ApprovalScope, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.query.summary(scope(p));
    }
    @Get('operation/:operationId')
    @ApiRoute({
        auth: 'required',
        summary: 'Recover a committed approval or inventory execution receipt',
        request: { params: c.ApprovalOperationParamsSchema },
        responses: [{ status: 200, schema: c.ApprovalOperationResultSchema }],
        errors,
    })
    operation(@Param() p: OperationParams, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.query.operation(scope(p), p.operationId);
    }
    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'List currently visible requests',
        request: { params: c.ApprovalScopeSchema, query: c.ApprovalQuerySchema },
        responses: [{ status: 200, schema: c.ApprovalRequestPageSchema }],
        errors,
    })
    list(
        @Param() p: c.ApprovalScope,
        @Query() query: c.ApprovalQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.query.list(scope(p), query);
    }
    @Post()
    @ApiRoute({
        auth: 'required',
        summary: 'Submit immutable multi-item intent to one non-self reviewer',
        request: { params: c.ApprovalScopeSchema, body: c.ApprovalSubmitSchema },
        responses: [{ status: 201, schema: c.ApprovalReceiptSchema }],
        errors,
    })
    submit(
        @Param() p: c.ApprovalScope,
        @Body() body: c.ApprovalSubmit,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.approval.submit(scope(p), body);
    }
    @Get(':requestId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read request decision and execution progress',
        request: { params: c.ApprovalParamsSchema },
        responses: [{ status: 200, schema: c.ApprovalRequestSchema }],
        errors,
    })
    get(@Param() p: RequestParams, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.query.get(scope(p), p.requestId);
    }
    @Get(':requestId/line')
    @ApiRoute({
        auth: 'required',
        summary: 'Read paged lines under current resource permissions',
        request: { params: c.ApprovalParamsSchema, query: c.ApprovalPageQuerySchema },
        responses: [{ status: 200, schema: c.ApprovalLinePageSchema }],
        errors,
    })
    lines(
        @Param() p: RequestParams,
        @Query() query: c.ApprovalPageQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.query.lines(scope(p), p.requestId, query);
    }
    @Get(':requestId/event')
    @ApiRoute({
        auth: 'required',
        summary: 'Read request lifecycle history under current permissions',
        request: { params: c.ApprovalParamsSchema, query: c.ApprovalPageQuerySchema },
        responses: [{ status: 200, schema: c.ApprovalEventPageSchema }],
        errors,
    })
    events(
        @Param() p: RequestParams,
        @Query() query: c.ApprovalPageQuery,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.query.events(scope(p), p.requestId, query);
    }
    @Post(':requestId/decision')
    @ApiRoute({
        auth: 'required',
        summary: 'Atomically approve or reject every line in a single review',
        request: { params: c.ApprovalParamsSchema, body: c.ApprovalDecisionSchema },
        responses: [{ status: 200, schema: c.ApprovalReceiptSchema }],
        errors,
    })
    decide(
        @Param() p: RequestParams,
        @Body() body: c.ApprovalDecision,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.approval.decide(scope(p), p.requestId, body);
    }
    @Post(':requestId/withdraw')
    @ApiRoute({
        auth: 'required',
        summary: 'Withdraw a complete pending request',
        request: { params: c.ApprovalParamsSchema, body: c.ApprovalCommandSchema },
        responses: [{ status: 200, schema: c.ApprovalReceiptSchema }],
        errors,
    })
    withdraw(
        @Param() p: RequestParams,
        @Body() body: c.ApprovalCommand,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.approval.withdraw(scope(p), p.requestId, body);
    }
    @Post(':requestId/line/:lineId/abandon')
    @ApiRoute({
        auth: 'required',
        summary: 'Applicant abandons one unexecuted approval',
        request: { params: c.ApprovalLineParamsSchema, body: c.ApprovalCommandSchema },
        responses: [{ status: 200, schema: c.ApprovalReceiptSchema }],
        errors,
    })
    abandon(
        @Param() p: LineParams,
        @Body() body: c.ApprovalCommand,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.approval.finish(scope(p), p.requestId, p.lineId, 'abandon', body);
    }
    @Post(':requestId/line/:lineId/revoke')
    @ApiRoute({
        auth: 'required',
        summary: 'Explicitly revoke one unexecuted approval',
        request: { params: c.ApprovalLineParamsSchema, body: c.ApprovalCommandSchema },
        responses: [{ status: 200, schema: c.ApprovalReceiptSchema }],
        errors,
    })
    revoke(
        @Param() p: LineParams,
        @Body() body: c.ApprovalCommand,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.approval.finish(scope(p), p.requestId, p.lineId, 'revoke', body);
    }
    @Post(':requestId/line/:lineId/execute')
    @ApiRoute({
        auth: 'required',
        summary: 'Applicant executes exactly the approved line once',
        request: { params: c.ApprovalLineParamsSchema, body: c.ApprovalExecuteSchema },
        responses: [{ status: 201, schema: c.ApprovalExecutionReceiptSchema }],
        errors,
    })
    execute(
        @Param() p: LineParams,
        @Body() body: c.ApprovalExecute,
        @Res({ passthrough: true }) reply: FastifyReply
    ) {
        reply.header('Cache-Control', 'no-store');
        return this.execution.execute(scope(p), p.requestId, p.lineId, body);
    }
}
