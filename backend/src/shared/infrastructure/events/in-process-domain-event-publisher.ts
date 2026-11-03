import { DomainEvent } from '../../domain/domain-event';
import { DomainEventPublisher, DomainEventSubscriber } from '../../application/ports/domain-event-publisher.port';

export class InProcessDomainEventPublisher implements DomainEventPublisher {
  private readonly subscribers: DomainEventSubscriber[] = [];

  subscribe(subscriber: DomainEventSubscriber): void {
    this.subscribers.push(subscriber);
  }

  async publish(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const subscriber of this.subscribers) await subscriber.handle(event);
    }
  }
}
