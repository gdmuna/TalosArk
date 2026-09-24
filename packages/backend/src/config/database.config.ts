import { registerAs, ConfigType } from '@nestjs/config';
import { z } from 'zod';

// database

export const DATABASE_URL = process.env.DATABASE_URL;

export const SHADOW_DATABASE_URL = process.env.SHADOW_DATABASE_URL;

const DatabaseConfigValidateSchema = z
    .object({
        DATABASE_URL: z.url(),
        SHADOW_DATABASE_URL: z.url(),
    })
    .transform((env) => ({
        databaseUrl: env.DATABASE_URL,
        shadowDatabaseUrl: env.SHADOW_DATABASE_URL,
    }));

export const databaseConfig = registerAs('database', () =>
    DatabaseConfigValidateSchema.parse(process.env)
);

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
