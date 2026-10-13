import 'reflect-metadata';
import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { AccountProvisionModule } from '../src/bootstrap/composition/account-provision.module.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { definedErrorId } from '../src/platform/error/error.factory.js';
import type { AllConfig } from '../src/config/index.js';

dayjs.extend(utc);
const program = new Command()
    .description(
        'Provision one local account; load the intended runtime env before invoking this command.'
    )
    .requiredOption('--username <name>', 'Case-sensitive username')
    .requiredOption('--email <email>', 'Account email')
    .requiredOption('--database <name>', 'Confirm the target database name')
    .option(
        '--reissue-activation',
        'Revoke old links and reissue for an unactivated operator-created account'
    )
    .option(
        '--show-activation-link',
        'Emit the secret activation link to this controlled terminal, never application logs'
    );
program.parse();
const options = program.opts<{
    username: string;
    email: string;
    database: string;
    showActivationLink?: boolean;
    reissueActivation?: boolean;
}>();
if (!options.showActivationLink) {
    console.error('Explicit --show-activation-link consent is required; no account was created.');
    process.exitCode = 1;
} else {
    const app = await NestFactory.createApplicationContext(AccountProvisionModule, {
        logger: false,
    });
    try {
        const config = app.get(ConfigService<AllConfig, true>);
        const target = new URL(config.get('database.databaseUrl', { infer: true }));
        if (decodeURIComponent(target.pathname.slice(1)) !== options.database)
            throw new Error('Target database confirmation does not match');
        const result = await app
            .get(AuthService)
            .provisionAccount(
                { username: options.username, email: options.email },
                options.reissueActivation
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
