import { z } from 'zod';
import { datasetStep } from '../seed.definition.js';
import { governanceAccounts } from '../dataset/account.dataset.js';
import { workspaceDataset } from '../dataset/workspace.dataset.js';
import {
    extraWorkspaceDataset,
    governanceTeam,
    otherOrganizationTeam,
    secondaryMemberships,
} from '../dataset/governance.dataset.js';
import type { DatasetGroup, GroupContext } from './seed.group.js';

export function governanceSteps(context: GroupContext) {
    if (context.actorUserId || context.target)
        throw new Error(
            'Governance scenarios create isolated accounts and scopes; do not supply --actor or an existing scope'
        );
    const accounts = datasetStep('account', governanceAccounts, {}, context.generation, () => ({}));
    const primary = datasetStep(
        'organization-a',
        workspaceDataset,
        { name: 'Seed organization A', workspaceName: 'Primary laboratory' },
        context.generation,
        (results) => ({ actorUserId: results.get(accounts)['owner-a'].userId, target: null })
    );
    const secondary = datasetStep(
        'secondary',
        extraWorkspaceDataset,
        {},
        context.generation,
        (results) => results.get(primary)
    );
    const empty = datasetStep(
        'empty',
        extraWorkspaceDataset,
        { name: 'Empty laboratory' },
        context.generation,
        (results) => results.get(primary)
    );
    const other = datasetStep(
        'organization-b',
        workspaceDataset,
        { name: 'Seed organization B', workspaceName: 'Other laboratory' },
        context.generation,
        (results) => ({ actorUserId: results.get(accounts)['owner-b'].userId, target: null })
    );
    const team = datasetStep('team', governanceTeam, {}, context.generation, (results) => ({
        scope: results.get(primary),
        accounts: results.get(accounts),
    }));
    const memberships = datasetStep(
        'membership',
        secondaryMemberships,
        {},
        context.generation,
        (results) => ({
            scope: results.get(secondary),
            team: results.get(team),
            accounts: results.get(accounts),
        })
    );
    const otherTeam = datasetStep(
        'other-team',
        otherOrganizationTeam,
        {},
        context.generation,
        (results) => ({ scope: results.get(other), accounts: results.get(accounts) })
    );
    return {
        accounts,
        primary,
        secondary,
        empty,
        other,
        team,
        steps: [accounts, primary, secondary, empty, other, team, memberships, otherTeam],
    };
}

export const governanceDemoGroup: DatasetGroup = {
    id: 'governance-demo',
    version: 1,
    description:
        'Twelve accounts, two organizations, four workspaces, scoped roles, membership and invitation lifecycles',
    build(parameters, context) {
        return {
            parameters: z.strictObject({}).parse(parameters),
            steps: governanceSteps(context).steps,
        };
    },
};

export const authorizationRegressionGroup: DatasetGroup = {
    id: 'authorization-regression',
    version: 1,
    description: 'Governance fixtures with explicit positive and negative authorization assertions',
    build: governanceDemoGroup.build,
};
