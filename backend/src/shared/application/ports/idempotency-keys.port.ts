export const IDEMPOTENCY_KEYS = Symbol('IdempotencyKeys');

export interface IdempotencyClaim {
  readonly actorId: string;
  /** The operation the key protects, so one key can serve several operations. */
  readonly scope: string;
  readonly key: string;
  /** Canonical content of the request: the same key must always come with the same content. */
  readonly fingerprint: string;
  /** Identifier of what this attempt creates, kept so that a replay can point to it. */
  readonly resourceId: string;
}

export type IdempotencyOutcome =
  | { readonly kind: 'claimed' }
  | { readonly kind: 'replayed'; readonly resourceId: string }
  | { readonly kind: 'mismatch' };

export interface IdempotencyKeys {
  /**
   * Registers the key inside the current transaction. Under concurrency the second caller waits for
   * the first transaction, then sees its outcome: only one attempt ever gets `claimed`.
   */
  claim(claim: IdempotencyClaim): Promise<IdempotencyOutcome>;
}
