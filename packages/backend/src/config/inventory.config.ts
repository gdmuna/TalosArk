import { registerAs, type ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { parseEnvironment } from './internal/config.validation.js';
const schema = z
    .object({
        INVENTORY_BUSINESS_TIME_ZONE: z
            .string()
            .default('Asia/Shanghai')
            .refine((value) => {
                try {
                    new Intl.DateTimeFormat('en', { timeZone: value }).format();
                    return true;
                } catch {
                    return false;
                }
            }, 'Expected an IANA time zone'),
    })
    .transform((env) => ({ timeZone: env.INVENTORY_BUSINESS_TIME_ZONE }));
export const inventoryConfig = registerAs('inventory', () => parseEnvironment(schema, 'inventory'));
export type InventoryConfig = ConfigType<typeof inventoryConfig>;
