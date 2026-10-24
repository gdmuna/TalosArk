import { z } from 'zod';
import { defineGroup, type SeedGroupBuilder } from '../definition/group.js';
import { governanceAccounts } from '../capability/identity/account.dataset.js';
import { workspaceDataset } from '../capability/workspace/workspace.dataset.js';
import {
    extraWorkspaceDataset,
    governanceTeam,
    otherOrganizationTeam,
    secondaryMemberships,
} from '../capability/governance/governance.dataset.js';

export function addGovernance(b: SeedGroupBuilder) {
    const accounts = b.step('account', governanceAccounts, {}, { from: {}, bind: () => ({}) });
    const primary = b.step(
        'organization-a',
        workspaceDataset,
        { name: 'Seed organization A', workspaceName: 'Primary laboratory' },
        {
            from: { accounts },
            bind: ({ accounts }) => ({ actorUserId: accounts['owner-a'].userId, target: null }),
        }
    );
    const secondary = b.step(
        'secondary',
        extraWorkspaceDataset,
        {},
        { from: { primary }, bind: ({ primary }) => primary }
    );
    const empty = b.step(
        'empty',
        extraWorkspaceDataset,
        { name: 'Empty laboratory' },
        { from: { primary }, bind: ({ primary }) => primary }
    );
    const other = b.step(
        'organization-b',
        workspaceDataset,
        { name: 'Seed organization B', workspaceName: 'Other laboratory' },
        {
            from: { accounts },
            bind: ({ accounts }) => ({ actorUserId: accounts['owner-b'].userId, target: null }),
        }
    );
    const team = b.step(
        'team',
        governanceTeam,
        {},
        {
            from: { primary, accounts },
            bind: ({ primary, accounts }) => ({ scope: primary, accounts }),
        }
    );
    b.step(
        'membership',
        secondaryMemberships,
        {},
        {
            from: { secondary, team, accounts },
            bind: ({ secondary, team, accounts }) => ({ scope: secondary, team, accounts }),
        }
    );
    b.step(
        'other-team',
        otherOrganizationTeam,
        {},
        { from: { other, accounts }, bind: ({ other, accounts }) => ({ scope: other, accounts }) }
    );
    b.expose({
        accounts,
        primaryScope: primary,
        secondaryScope: secondary,
        emptyScope: empty,
        otherScope: other,
    });
    return { accounts, primary, secondary, empty, other, team };
}

export const governanceDemoGroup = defineGroup({
    id: 'governance-demo',
    version: 2,
    purpose: 'regression',
    description:
        'Isolated governance personas, scopes, invitations and positive/negative authorization assertions',
    parameters: z.strictObject({}),
    scopeModes: ['provision'],
    build(_p, b) {
        addGovernance(b);
    },
});
