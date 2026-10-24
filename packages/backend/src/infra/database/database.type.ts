import type { createDatabaseQueryClient } from './database.query.js';

export type DatabaseQueryClient = Omit<
    ReturnType<typeof createDatabaseQueryClient>,
    '$connect' | '$disconnect' | '$extends' | '$transaction'
>;
