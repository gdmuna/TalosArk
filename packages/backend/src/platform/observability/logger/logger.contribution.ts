import type { ExtensionSource } from '../../extensions/index.js';
import type { ErrorDiagnosticProjector } from './logger.diagnostic.js';
import type { PrettyAdapterMap } from './pretty/pretty.adapter.js';

export interface LoggerContribution {
    readonly id: string;
    readonly diagnostic?: { readonly default: ErrorDiagnosticProjector };
    readonly pretty?: { readonly moduleUrl: string; readonly default: PrettyAdapterMap };
}

/** The only contribution data transferred across the worker boundary. */
export interface PrettyModuleReference {
    readonly id: string;
    readonly moduleUrl: string;
    readonly source: ExtensionSource;
}
