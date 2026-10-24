export type IdempotencyJsonValue =
    | string
    | number
    | boolean
    | null
    | readonly IdempotencyJsonValue[]
    | { readonly [key: string]: IdempotencyJsonValue };

export type IdempotencyScope =
    | {
          readonly kind: 'workspace';
          readonly organizationId: string;
          readonly workspaceId: string;
      }
    | {
          readonly kind: 'organization-user';
          readonly organizationId: string;
          readonly userId: string;
      };

export interface IdempotencyPrepareInput {
    readonly scope: IdempotencyScope;
    readonly operation: string;
    readonly key: string;
    readonly payload: IdempotencyJsonValue;
    readonly fingerprintVersion?: number;
}

export interface PreparedIdempotencyRequest {
    readonly scope: IdempotencyScope;
    readonly operation: string;
    readonly key: string;
    readonly fingerprintVersion: number;
    readonly fingerprint: string;
}

export interface IdempotencyLease {
    readonly leaseId: string;
    readonly transactionId: string;
    readonly request: PreparedIdempotencyRequest;
}

export interface IdempotencyResultCodec<T> {
    readonly encode: (value: T) => IdempotencyJsonValue;
    readonly decode: (value: IdempotencyJsonValue) => T;
}

export type IdempotencyExecution<T> =
    | { readonly kind: 'executed'; readonly value: T }
    | { readonly kind: 'replayed'; readonly value: T };
