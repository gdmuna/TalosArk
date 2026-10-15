import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';

export const TeamErrorContract = {
    accessDenied: defineErrorContract('TEAM_ACCESS_DENIED', 'Team access is denied', z.null()),
    conflict: defineErrorContract(
        'TEAM_CONFLICT',
        'Team operation conflicts with its current state',
        z.null()
    ),
    invitationInvalid: defineErrorContract(
        'TEAM_INVITATION_INVALID',
        'Invitation is invalid, expired or unavailable to this account',
        z.null()
    ),
    accountUnavailable: defineErrorContract(
        'TEAM_ACCOUNT_UNAVAILABLE',
        'An eligible existing account is required',
        z.null()
    ),
    unavailable: defineErrorContract(
        'TEAM_UNAVAILABLE',
        'Team operation is temporarily unavailable',
        z.null()
    ),
} as const;
