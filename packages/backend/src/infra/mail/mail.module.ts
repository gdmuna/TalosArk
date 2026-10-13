import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { MailService } from './mail.service.js';
import {
    MAIL_OPTIONS,
    type MailModuleOptions,
    type MailModuleAsyncOptions,
} from './mail.options.js';

@Module({})
export class MailModule {
    static forRoot(options: MailModuleOptions): DynamicModule {
        return {
            module: MailModule,
            imports: options.imports ?? [],
            providers: this.createProviders({ provide: MAIL_OPTIONS, useValue: options }),
            exports: [MailService],
        };
    }

    static forRootAsync(options: MailModuleAsyncOptions): DynamicModule {
        return {
            module: MailModule,
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
