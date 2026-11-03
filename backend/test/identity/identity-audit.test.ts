import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdentityAuditSubscriber } from '../../src/modules/identity/application/subscribers/identity-audit.subscriber';
import { IdentityEvent } from '../../src/modules/identity/domain/events/identity-events';
import { InMemoryAuditLog, uuid } from '../support/fakes';

test('each identity event produces one audit entry for the acting user', async () => {
  const audit = new InMemoryAuditLog();
  const subscriber = new IdentityAuditSubscriber(audit);
  const events: IdentityEvent[] = [
    { type: 'UserRegistered', userId: uuid(1) },
    { type: 'SessionOpened', userId: uuid(1), sessionId: uuid(2) },
    { type: 'SessionRefreshed', userId: uuid(1), sessionId: uuid(2) },
    { type: 'SessionRevoked', userId: uuid(1), sessionId: uuid(2) },
  ];
  for (const event of events) await subscriber.handle(event);
  assert.deepEqual(audit.entries, [
    { userId: uuid(1), action: 'user.registered' },
    { userId: uuid(1), action: 'session.login' },
    { userId: uuid(1), action: 'session.refresh' },
    { userId: uuid(1), action: 'session.logout' },
  ]);
});

test('events of other modules are ignored', async () => {
  const audit = new InMemoryAuditLog();
  await new IdentityAuditSubscriber(audit).handle({ type: 'MembershipRevoked' });
  assert.deepEqual(audit.entries, []);
});
