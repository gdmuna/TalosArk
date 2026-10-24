import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { BusinessSeeder } from '../../runtime/handler.js';
import { stockAssertionKind } from './stock-assertion.kind.js';
import { StockFactsReader } from './stock-facts.reader.js';

@Injectable()
export class StockAssertionSeeder implements BusinessSeeder<typeof stockAssertionKind> {
    constructor(private readonly facts: StockFactsReader) {}

    async seed(
        data: z.output<typeof stockAssertionKind.data>,
        { receipt, facility }: z.output<typeof stockAssertionKind.input>
    ) {
        const scope = receipt.scope;
        if (
            scope.organizationId !== facility.scope.organizationId ||
            scope.workspaceId !== facility.scope.workspaceId
        )
            throw new Error('Stock assertion references different scopes');
        const targets = data.expectations.map((expected) => {
            const stock = receipt.stocks[expected.stockIndex];
            if (!stock) throw new Error(`Missing declared stock index ${expected.stockIndex}`);
            const nodeId =
                expected.positionIndex === null ? null : facility.positions[expected.positionIndex];
            if (nodeId === undefined)
                throw new Error(`Missing declared position index ${expected.positionIndex}`);
            return { stock, expected, nodeId };
        });
        const rows = await this.facts.read(
            scope,
            targets.map(({ stock }) => stock.stockItemId)
        );
        const facts = new Map(rows.map((row) => [row.id, row]));
        const failures: string[] = [];
        for (const { stock, expected, nodeId } of targets) {
            const fact = facts.get(stock.stockItemId);
            if (!fact) {
                failures.push(
                    `${stock.stockItemId}: expected a stock item in the declared scope; received missing`
                );
                continue;
            }
            const prefix = `stock[${expected.stockIndex}] ${stock.stockItemId}`;
            if (fact.instanceId !== stock.instanceId)
                failures.push(
                    `${prefix}: expected instance ${stock.instanceId}; received ${fact.instanceId}`
                );
            if (!fact.quantity.equals(expected.quantity))
                failures.push(
                    `${prefix}: expected quantity ${expected.quantity}; received ${fact.quantity.toString()}`
                );
            if (fact.status !== expected.status)
                failures.push(
                    `${prefix}: expected status ${expected.status}; received ${fact.status}`
                );
            const actualNode = fact.placement?.storageNodeId ?? null;
            if (actualNode !== nodeId)
                failures.push(
                    `${prefix}: expected position ${nodeId ?? 'none'}; received ${actualNode ?? 'none'}`
                );
        }
        if (failures.length) throw new Error(`Inventory assertion failed:\n${failures.join('\n')}`);
        return { checked: targets.length };
    }
}
