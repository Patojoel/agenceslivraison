import { AuditLog } from '../../../../shared/application/ports/audit-log';
import { DomainEventSubscriber } from '../../../../shared/application/ports/domain-events';
import { DomainEvent } from '../../../../shared/domain/domain-event';
import { IdentityEvent, isIdentityEvent } from '../../domain/events/identity-events';

const ACTIONS: Record<IdentityEvent['type'], string> = {
  UserRegistered: 'user.registered',
  SessionOpened: 'session.login',
  SessionRefreshed: 'session.refresh',
  SessionRevoked: 'session.logout',
};

export class IdentityAuditSubscriber implements DomainEventSubscriber {
  constructor(private readonly audit: AuditLog) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!isIdentityEvent(event)) return;
    await this.audit.record({ userId: event.userId, action: ACTIONS[event.type] });
  }
}
