import type { IdempotencyJsonValue, IdempotencyLease } from './idempotency.types.js';

export type IdempotencyReservation =
    | { readonly kind: 'acquired' }
    | {
          readonly kind: 'completed';
          readonly fingerprint: string;
          readonly result: IdempotencyJsonValue;
      }
    | { readonly kind: 'in-progress'; readonly fingerprint: string }
    | { readonly kind: 'result-unavailable'; readonly fingerprint: string };

export interface IdempotencyRepository {
    /** Atomically reserve scope + key in the active transaction; operation is not a namespace. */
    claim(lease: IdempotencyLease): Promise<IdempotencyReservation>;

    /** Persist completion in the same transaction; false means the reservation was lost. */
    complete(lease: IdempotencyLease, result: IdempotencyJsonValue): Promise<boolean>;
}
