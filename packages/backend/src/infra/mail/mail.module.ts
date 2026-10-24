import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { MAIL_OPTIONS, type MailModuleAsyncOptions } from './mail.options.js';
import { LoggerExtension } from '@/platform/observability/logger/logger-contribution.decorator.js';
import { mailLogContribution } from './mail.log.contribution.js';

@LoggerExtension(mailLogContribution)
@Module({})
export class MailModule {
    static forRootAsync(options: MailModuleAsyncOptions): DynamicModule {
        return {
            module: MailModule,
            global: true,
            imports: options.imports ?? [],
            providers: this.createProviders({
                provide: MAIL_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject ?? [],
            }),
            exports: [MailService],
        };
    }

    private static createProviders(optionsProvider: Provider): Provider[] {
        return [optionsProvider, MailService];
    }
}
