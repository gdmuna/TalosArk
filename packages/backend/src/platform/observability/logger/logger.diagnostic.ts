export type DiagnosticValue =
    | string
    | number
    | boolean
    | null
    | readonly DiagnosticValue[]
    | { readonly [field: string]: DiagnosticValue | undefined };

/** Owner-approved data only. The serializer reserves error structure; message may override. */
export interface ErrorDiagnosticProjection {
    readonly message?: string;
    readonly [field: string]: DiagnosticValue | undefined;
}

export type ErrorDiagnosticProjector = (error: Error) => ErrorDiagnosticProjection | undefined;
