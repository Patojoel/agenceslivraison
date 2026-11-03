import { createHash } from 'node:crypto';
import { AuditEntry, AuditLog } from '../../src/shared/application/ports/audit-log';
import { Clock } from '../../src/shared/application/ports/clock';
import { DomainEventPublisher } from '../../src/shared/application/ports/domain-events';
import { IdGenerator } from '../../src/shared/application/ports/id-generator';
import { TokenSecrets } from '../../src/shared/application/ports/token-secrets';
import { DomainEvent } from '../../src/shared/domain/domain-event';
import { TokenDigest } from '../../src/shared/domain/vo/token-digest';

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

export class SequentialIds implements IdGenerator {
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
