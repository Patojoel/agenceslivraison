import { DomainEvent } from './domain-event';

export abstract class AggregateRoot<E extends DomainEvent> {
  private pending: E[] = [];

  protected record(event: E): void {
    this.pending.push(event);
  }

  pullEvents(): readonly E[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }
}
