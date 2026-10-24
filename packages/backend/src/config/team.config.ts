import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { parseEnvironment } from './internal/config.validation.js';

const schema = z
    .object({
        TEAM_INVITATION_URL: z
            .url()
            .default('http://localhost:4444/auth/invitation')
            .refine((value) => {
                const url = new URL(value);
                return (
                    ['http:', 'https:'].includes(url.protocol) &&
                    !url.username &&
                    !url.password &&
                    !url.search &&
                    !url.hash &&
                    (process.env.NODE_ENV !== 'production' || url.protocol === 'https:')
                );
            }),
        TEAM_INVITATION_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(604800),
    })
    .transform((env) => ({
        invitationUrl: env.TEAM_INVITATION_URL,
        invitationTtlSeconds: env.TEAM_INVITATION_TTL_SECONDS,
    }));

export const teamConfig = registerAs('team', () => parseEnvironment(schema, 'team'));
export type TeamConfig = ConfigType<typeof teamConfig>;
