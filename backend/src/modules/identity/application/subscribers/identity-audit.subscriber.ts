import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG, AuditLog } from '@shared/application/ports/audit-log.port';
import { DomainEventSubscriber } from '@shared/application/ports/domain-event-publisher.port';
import { DomainEvent } from '@shared/domain/domain-event';
import { IdentityEvent, isIdentityEvent } from '../../domain/events/identity-events';

const ACTIONS: Record<IdentityEvent['type'], string> = {
  UserRegistered: 'user.registered',
  SessionOpened: 'session.login',
  SessionRefreshed: 'session.refresh',
  SessionRevoked: 'session.logout',
};

@Injectable()
export class IdentityAuditSubscriber implements DomainEventSubscriber {
  constructor(@Inject(AUDIT_LOG) private readonly audit: AuditLog) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!isIdentityEvent(event)) return;
    await this.audit.record({ userId: event.userId, action: ACTIONS[event.type] });
  }
}
