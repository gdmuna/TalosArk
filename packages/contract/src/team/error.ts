import { z } from 'zod';
import { defineErrorContract } from '../protocol/error.js';

export const TeamErrorContract = {
    accessDenied: defineErrorContract('TEAM_ACCESS_DENIED', 'Team access is denied', z.null()),
} as const;
