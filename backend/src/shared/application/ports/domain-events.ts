import { DomainEvent } from '../../domain/domain-event';

export const DOMAIN_EVENT_PUBLISHER = Symbol('DomainEventPublisher');

/** Delivers events synchronously, inside the caller's transaction. */
export interface DomainEventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>;
}

export interface DomainEventSubscriber {
  handle(event: DomainEvent): Promise<void>;
}
