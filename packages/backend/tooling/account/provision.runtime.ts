import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { AccountProvisionModule } from '../../src/bootstrap/composition/account-provision.module.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { definedErrorId } from '../../src/platform/error/error.factory.js';
import type { AllConfig } from '../../src/config/index.js';

export interface ProvisionInput {
    username: string;
    email: string;
    database: string;
    reissueActivation?: boolean;
}

export async function execute(input: ProvisionInput): Promise<void> {
    dayjs.extend(utc);
    const app = await NestFactory.createApplicationContext(AccountProvisionModule, {
        logger: false,
        abortOnError: false,
    });
    try {
        const config = app.get(ConfigService<AllConfig, true>);
        const target = new URL(config.get('database.databaseUrl', { infer: true }));
        if (decodeURIComponent(target.pathname.slice(1)) !== input.database)
            throw new Error('Target database confirmation does not match');
        const result = await app
            .get(AuthService)
            .provisionAccount(
                { username: input.username, email: input.email },
                input.reissueActivation
            );
        process.stdout.write(
            `${JSON.stringify({ ...result, expiresAt: result.expiresAt.toISOString() })}\n`
        );
    } catch (error) {
        console.error(
            `Account provision failed: ${definedErrorId(error) ?? 'configuration-or-infrastructure-failure'}. No credentials are printed.`
        );
        process.exitCode = 1;
    } finally {
        await app.close();
    }
}
