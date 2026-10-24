import type { SeedGroupBuilder } from '../definition/group.js';
import { workspaceDataset } from '../capability/workspace/workspace.dataset.js';
import { ownerAccount } from '../capability/identity/account.dataset.js';
import type { SeedRef } from '../definition/group.js';
import type { z } from 'zod';
import type { workspaceKind } from '../capability/workspace/workspace.kind.js';

const baselines = new WeakMap<SeedGroupBuilder, SeedRef<z.output<typeof workspaceKind.output>>>();

export function addWorkspaceBaseline(b: SeedGroupBuilder) {
    const previous = baselines.get(b);
    if (previous) return previous;
    const selection = b.context.scope;
    if (selection.kind !== 'provision') {
        const scope = b.step(
            'workspace',
            workspaceDataset,
            {},
            {
                from: {},
                bind: () => ({
                    actorUserId: selection.userId,
                    target:
                        selection.kind === 'workspace'
                            ? {
                                  organizationId: selection.organizationId,
                                  workspaceId: selection.workspaceId,
                              }
                            : null,
                }),
            }
        );
        baselines.set(b, scope);
        b.expose({ primaryScope: scope });
        return scope;
    }
    const account = b.step('account', ownerAccount, {}, { from: {}, bind: () => ({}) });
    b.expose({ accounts: account });
    const scope = b.step(
        'workspace',
        workspaceDataset,
        {},
        {
            from: { account },
            bind: ({ account }) => ({ actorUserId: account.owner.userId, target: null }),
        }
    );
    baselines.set(b, scope);
    b.expose({ primaryScope: scope });
    return scope;
}
