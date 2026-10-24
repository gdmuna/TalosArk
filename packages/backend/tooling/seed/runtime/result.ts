import { z } from 'zod';

export type SeedMode = 'apply' | 'verify' | 'resume';
export interface SeedDiagnostic {
    stage: 'execution' | 'verification' | 'delivery' | 'cleanup';
    code: string;
    message: string;
    step?: string;
    key?: string;
}
export interface SeedVerification {
    step: string;
    key?: string;
    status: 'verified' | 'unsealed' | 'missing' | 'changed' | 'blocked';
    message?: string;
}
export interface SeedRunResult {
    namespace: string;
    planHash: string;
    attemptId?: string;
    mode: SeedMode;
    execution: 'completed' | 'partial' | 'failed' | 'cancelled' | 'uncertain';
    delivery: 'not-requested' | 'completed' | 'failed';
    outputs: Record<string, unknown>;
    exposed: Record<string, unknown>;
    verification: SeedVerification[];
    diagnostics: SeedDiagnostic[];
}

export function seedErrorMessage(error: unknown): string {
    if (error instanceof z.ZodError)
        return error.issues
            .map((issue) => `${issue.path.join('.') || '<root>'} (${issue.code})`)
            .join(', ');
    return error instanceof Error ? error.message : 'Seed operation failed';
}

/** A missing receipt blocks this step, not verification of independent steps. */
export class SeedMissingReceipt extends Error {}
