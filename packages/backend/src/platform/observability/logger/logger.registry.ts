import { Injectable, Module } from '@nestjs/common';
import { ExtensionDiscovery, ExtensionDiscoveryModule } from '../../extensions/discovery/index.js';
import { createExtensionIndex } from '../../extensions/index.js';
import { loggerPoint } from './logger-contribution.decorator.js';
import type { PrettyModuleReference } from './logger.contribution.js';
import type { ErrorDiagnosticProjector } from './logger.diagnostic.js';

@Injectable()
export class LoggerContributions {
    private snapshot?: Readonly<{
        diagnostics: readonly ErrorDiagnosticProjector[];
        pretty: readonly PrettyModuleReference[];
    }>;

    constructor(private readonly discovery: ExtensionDiscovery) {}

    collect() {
        if (this.snapshot) return this.snapshot;
        const index = createExtensionIndex(
            this.discovery.collectDeclarations(loggerPoint).map(({ metadata, source }) => ({
                key: metadata.id,
                value: metadata,
                source,
            }))
        );
        const diagnostics: ErrorDiagnosticProjector[] = [];
        const pretty: PrettyModuleReference[] = [];
        // Stable first-match order, independent of Nest's module traversal order.
        const entries = [...index.entries()].sort((a, b) =>
            a.key < b.key ? -1 : a.key > b.key ? 1 : 0
        );
        for (const { key: id, value, source } of entries) {
            if (value.diagnostic) diagnostics.push(value.diagnostic.default);
            if (value.pretty)
                pretty.push(Object.freeze({ id, moduleUrl: value.pretty.moduleUrl, source }));
        }
        this.snapshot = Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            pretty: Object.freeze(pretty),
        });
        return this.snapshot;
    }

    readonly project: ErrorDiagnosticProjector = (error) => {
        for (const project of this.collect().diagnostics) {
            try {
                const projection = project(error);
                if (projection !== undefined) return projection;
            } catch {
                // Optional diagnostics must not suppress this error or later projectors.
            }
        }
        return undefined;
    };
}

@Module({
    imports: [ExtensionDiscoveryModule],
    providers: [LoggerContributions],
    exports: [LoggerContributions],
})
export class LoggerContributionModule {}
