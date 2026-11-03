import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgencyAuditSubscriber } from '../../src/modules/agencies/application/subscribers/agency-audit.subscriber';
import { AgencyEvent } from '../../src/modules/agencies/domain/events/agency-events';
import { InMemoryAuditLog, uuid } from '../support/fakes';

test('agency events are audited with the agency and, when relevant, the affected user', async () => {
  const audit = new InMemoryAuditLog();
  const subscriber = new AgencyAuditSubscriber(audit);
  const events: AgencyEvent[] = [
    { type: 'InvitationIssued', agencyId: uuid(10), actorId: uuid(1) },
    { type: 'InvitationAccepted', agencyId: uuid(10), userId: uuid(7) },
    { type: 'MembershipRoleChanged', agencyId: uuid(10), actorId: uuid(1), subjectUserId: uuid(3) },
    { type: 'MembershipRevoked', agencyId: uuid(10), actorId: uuid(1), subjectUserId: uuid(3) },
  ];
  for (const event of events) await subscriber.handle(event);
  assert.deepEqual(audit.entries, [
    { userId: uuid(1), action: 'invitation.created', agencyId: uuid(10) },
    { userId: uuid(7), action: 'invitation.accepted', agencyId: uuid(10), subjectUserId: uuid(7) },
    { userId: uuid(1), action: 'membership.role_changed', agencyId: uuid(10), subjectUserId: uuid(3) },
    { userId: uuid(1), action: 'membership.removed', agencyId: uuid(10), subjectUserId: uuid(3) },
  ]);
});

test('identity events are ignored', async () => {
  const audit = new InMemoryAuditLog();
  await new AgencyAuditSubscriber(audit).handle({ type: 'UserRegistered' });
  assert.deepEqual(audit.entries, []);
});
