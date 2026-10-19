import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import * as c from '@talos-ark/contracts/inventory';
import {
    InventoryErrorDefinition,
    MaterialErrorDefinition,
    FacilityErrorDefinition,
    TeamErrorDefinition,
} from '@talos-ark/contracts/backend';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { InventoryService } from '../application/inventory.service.js';
import { InventoryRelocationService } from '../application/inventory-relocation.service.js';
import { InventoryGovernanceService } from '../application/inventory-governance.service.js';
const errors = [
    ...Object.values(InventoryErrorDefinition),
    ...Object.values(MaterialErrorDefinition),
    ...Object.values(FacilityErrorDefinition),
    TeamErrorDefinition.forbidden,
];
type StockParams = z.infer<typeof c.StockParamsSchema>;
type TransactionParams = z.infer<typeof c.TransactionParamsSchema>;
@Controller('organization/:organizationId/workspace/:workspaceId/inventory')
export class InventoryController {
    constructor(private readonly inventory: InventoryService) {}
    @Get('context')
    @ApiRoute({
        auth: 'required',
        summary: 'Read inventory capabilities and business calendar',
        request: { params: c.InventoryScopeSchema },
        responses: [{ status: 200, schema: c.InventoryContextSchema }],
        errors,
    })
    context(@Param() p: c.InventoryScope, @Res({ passthrough: true }) r: FastifyReply) {
        r.header('Cache-Control', 'no-store');
        return this.inventory.context(p);
    }
    @Get()
    @ApiRoute({
        auth: 'required',
        summary: 'List physical inventory items',
        request: { params: c.InventoryScopeSchema, query: c.InventoryQuerySchema },
        responses: [{ status: 200, schema: c.StockPageSchema }],
        errors,
    })
    list(
        @Param() p: c.InventoryScope,
        @Query() q: c.InventoryQuery,
        @Res({ passthrough: true }) r: FastifyReply
    ) {
        r.header('Cache-Control', 'no-store');
        return this.inventory.list(p, q);
    }
    @Post('receipt')
    @ApiRoute({
        auth: 'required',
        summary: 'Atomically register one physical item at an empty position',
        request: { params: c.InventoryScopeSchema, body: c.ReceiptSchema },
        responses: [{ status: 201, schema: c.OperationReceiptSchema }],
        errors,
    })
    receive(@Param() p: c.InventoryScope, @Body() b: c.Receipt) {
        return this.inventory.receive(p, b);
    }
    @Get('transaction')
    @ApiRoute({
        auth: 'required',
        summary: 'List workspace inventory transactions',
        request: { params: c.InventoryScopeSchema, query: c.InventoryQuerySchema },
        responses: [{ status: 200, schema: c.TransactionPageSchema }],
        errors,
    })
    transactions(
        @Param() p: c.InventoryScope,
        @Query() q: c.InventoryQuery,
        @Res({ passthrough: true }) r: FastifyReply
    ) {
        r.header('Cache-Control', 'no-store');
        return this.inventory.transactions(p, q);
    }
    @Get('transaction/:transactionId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read immutable inventory transaction snapshots',
        request: { params: c.TransactionParamsSchema },
        responses: [{ status: 200, schema: c.TransactionSchema }],
        errors,
    })
    transaction(@Param() p: TransactionParams, @Res({ passthrough: true }) r: FastifyReply) {
        r.header('Cache-Control', 'no-store');
        return this.inventory.transactions(p, c.InventoryQuerySchema.parse({}), p.transactionId);
    }
    @Get(':stockItemId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read a physical inventory item',
        request: { params: c.StockParamsSchema },
        responses: [{ status: 200, schema: c.StockSchema }],
        errors,
    })
    get(@Param() p: StockParams, @Res({ passthrough: true }) r: FastifyReply) {
        r.header('Cache-Control', 'no-store');
        return this.inventory.get(p, p.stockItemId);
    }
    @Patch(':stockItemId/facts')
    @ApiRoute({
        auth: 'required',
        summary: 'Correct descriptive facts without changing stock balances or placement',
        request: { params: c.StockParamsSchema, body: c.InstanceCorrectionSchema },
        responses: [{ status: 200, schema: c.StockSchema }],
        errors,
    })
    correct(@Param() p: StockParams, @Body() b: c.InstanceCorrection) {
        return this.inventory.correct(p, p.stockItemId, b);
    }
}
@Controller('organization/:organizationId/inventory')
export class InventoryOperationController {
    constructor(
        private readonly inventory: InventoryService,
        private readonly relocation: InventoryRelocationService,
        private readonly governance: InventoryGovernanceService
    ) {}
    @Post('initialize')
    @ApiRoute({
        auth: 'required',
        summary: 'Explicitly initialize inventory grants for existing workspace managers',
        request: { params: c.InventoryOrgSchema },
        responses: [{ status: 200, schema: z.object({ updated: z.boolean() }) }],
        errors,
    })
    initialize(@Param() p: z.infer<typeof c.InventoryOrgSchema>) {
        return this.governance.initialize(p.organizationId);
    }
    @Post('container-relocation/preview')
    @ApiRoute({
        auth: 'required',
        summary: 'Preview a fully authorized stocked-container relocation',
        request: { params: c.InventoryOrgSchema, body: c.RelocationSchema },
        responses: [{ status: 200, schema: c.RelocationPreviewSchema }],
        errors,
    })
    preview(
        @Param() p: z.infer<typeof c.InventoryOrgSchema>,
        @Body() b: c.Relocation,
        @Res({ passthrough: true }) r: FastifyReply
    ) {
        r.header('Cache-Control', 'no-store');
        return this.relocation.preview(p.organizationId, b);
    }
    @Post('container-relocation')
    @ApiRoute({
        auth: 'required',
        summary: 'Atomically relocate a container and all authorized workspace stock',
        request: { params: c.InventoryOrgSchema, body: c.RelocationExecuteSchema },
        responses: [{ status: 201, schema: c.OperationReceiptSchema }],
        errors,
    })
    relocate(@Param() p: z.infer<typeof c.InventoryOrgSchema>, @Body() b: c.RelocationExecute) {
        return this.relocation.execute(p.organizationId, b);
    }
    @Get('operation/:operationId')
    @ApiRoute({
        auth: 'required',
        summary: 'Read an operation receipt under current permissions',
        request: { params: c.OperationParamsSchema },
        responses: [{ status: 200, schema: c.OperationReceiptSchema }],
        errors,
    })
    operation(
        @Param() p: z.infer<typeof c.OperationParamsSchema>,
        @Res({ passthrough: true }) r: FastifyReply
    ) {
        r.header('Cache-Control', 'no-store');
        return this.inventory.operation(p.organizationId, p.operationId);
    }
}
