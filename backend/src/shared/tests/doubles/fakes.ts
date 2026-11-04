import { createHash } from 'node:crypto';
import { AuditEntry, AuditLog } from '../../application/ports/audit-log.port';
import { IdempotencyClaim, IdempotencyKeys, IdempotencyOutcome } from '../../application/ports/idempotency-keys.port';
import { Clock } from '../../domain/ports/clock.port';
import { DomainEventPublisher } from '../../application/ports/domain-event-publisher.port';
import { UuidGenerator } from '../../domain/ports/uuid-generator.port';
import { TokenSecrets } from '../../application/ports/token-secrets.port';
import { DomainEvent } from '../../domain/domain-event';
import { TokenDigest } from '../../domain/value-objects/token-digest';

export const T0 = new Date('2026-01-01T00:00:00.000Z');
export const DAY = 24 * 60 * 60 * 1000;

export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export class FixedClock implements Clock {
  constructor(private current: Date = T0) {}

  now(): Date {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export class SequentialIds implements UuidGenerator {
  private next = 1000;

  generate(): string {
    return uuid(this.next++);
  }
}

export class DeterministicTokenSecrets implements TokenSecrets {
  private next = 1;

  generate(): string {
    return `secret${String(this.next++).padStart(37, '0')}`;
  }

  digest(secret: string): TokenDigest {
    return TokenDigest.of(createHash('sha256').update(secret).digest('hex'));
  }
}

export class RecordingEventPublisher implements DomainEventPublisher {
  readonly published: DomainEvent[] = [];

  async publish(events: readonly DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }

  types(): string[] {
    return this.published.map(event => event.type);
  }
}

export class InMemoryAuditLog implements AuditLog {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

/** Indexed access that fails the test instead of yielding `undefined`. */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at index ${index}`);
  return item;
}

/** `[id, secret]` of an opaque `<id>.<secret>` token. */
export function tokenParts(token: string): [string, string] {
  const [id, secret] = token.split('.');
  if (!id || !secret) throw new Error('malformed opaque token');
  return [id, secret];
}

export class InMemoryIdempotencyKeys implements IdempotencyKeys {
  private readonly rows = new Map<string, { fingerprint: string; resourceId: string }>();

  async claim(claim: IdempotencyClaim): Promise<IdempotencyOutcome> {
    const id = [claim.actorId, claim.scope, claim.key].join('|');
    const existing = this.rows.get(id);
    if (!existing) {
      this.rows.set(id, { fingerprint: claim.fingerprint, resourceId: claim.resourceId });
      return { kind: 'claimed' };
    }
    return existing.fingerprint === claim.fingerprint ? { kind: 'replayed', resourceId: existing.resourceId } : { kind: 'mismatch' };
  }
}
