import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgencyAuditSubscriber } from '../../application/subscribers/agency-audit.subscriber';
import { AgencyEvent } from '../../domain/events/agency-events';
import { InMemoryAuditLog, uuid } from '@shared/tests/doubles/fakes';

test('agency events are audited with the agency and, when relevant, the affected user', async () => {
  const audit = new InMemoryAuditLog();
  const subscriber = new AgencyAuditSubscriber(audit);
  const events: AgencyEvent[] = [
    { type: 'AgencyRegistered', agencyId: uuid(10), actorId: uuid(1) },
    { type: 'InvitationIssued', agencyId: uuid(10), actorId: uuid(1) },
    { type: 'InvitationAccepted', agencyId: uuid(10), userId: uuid(7) },
    { type: 'MembershipRoleChanged', agencyId: uuid(10), actorId: uuid(1), subjectUserId: uuid(3) },
    { type: 'MembershipRevoked', agencyId: uuid(10), actorId: uuid(1), subjectUserId: uuid(3) },
  ];
  for (const event of events) await subscriber.handle(event);
  assert.deepEqual(audit.entries, [
    { userId: uuid(1), action: 'agency.created', agencyId: uuid(10) },
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

test('identity and profile updates are audited with the names of the changed fields only', async () => {
  const audit = new InMemoryAuditLog();
  const subscriber = new AgencyAuditSubscriber(audit);
  const events: AgencyEvent[] = [
    { type: 'AgencyIdentityUpdated', agencyId: uuid(10), actorId: uuid(2), fields: ['primaryPhone', 'niu'] },
    { type: 'AgencyProfileUpdated', agencyId: uuid(10), actorId: uuid(2), fields: ['description'] },
  ];
  for (const event of events) await subscriber.handle(event);
  assert.deepEqual(audit.entries, [
    { userId: uuid(2), action: 'agency.identity_updated', agencyId: uuid(10), details: { fields: ['primaryPhone', 'niu'] } },
    { userId: uuid(2), action: 'agency.profile_updated', agencyId: uuid(10), details: { fields: ['description'] } },
  ]);
});

test('zone, site and capability events are audited by action, with names or types only', async () => {
  const audit = new InMemoryAuditLog();
  const subscriber = new AgencyAuditSubscriber(audit);
  const events: AgencyEvent[] = [
    { type: 'ServiceZoneAdded', agencyId: uuid(10), actorId: uuid(2), zoneId: uuid(501), reactivated: false },
    { type: 'ServiceZoneAdded', agencyId: uuid(10), actorId: uuid(2), zoneId: uuid(501), reactivated: true },
    { type: 'ServiceZoneRetired', agencyId: uuid(10), actorId: uuid(2), zoneId: uuid(501) },
    { type: 'AgencySiteCreated', agencyId: uuid(10), actorId: uuid(2), siteId: uuid(601) },
    { type: 'AgencySiteUpdated', agencyId: uuid(10), actorId: uuid(2), siteId: uuid(601), fields: ['address', 'phone'] },
    { type: 'AgencySiteDeactivated', agencyId: uuid(10), actorId: uuid(2), siteId: uuid(601) },
    { type: 'AgencySiteReactivated', agencyId: uuid(10), actorId: uuid(2), siteId: uuid(601) },
    { type: 'AgencyCapabilityEnabled', agencyId: uuid(10), actorId: uuid(2), capability: 'delivery' },
    { type: 'AgencyCapabilitySuspended', agencyId: uuid(10), actorId: uuid(2), capability: 'storage' },
  ];
  for (const event of events) await subscriber.handle(event);
  const agencyId = uuid(10);
  const userId = uuid(2);
  assert.deepEqual(audit.entries, [
    { userId, action: 'agency.zone_added', agencyId },
    { userId, action: 'agency.zone_reactivated', agencyId },
    { userId, action: 'agency.zone_retired', agencyId },
    { userId, action: 'agency.site_created', agencyId },
    { userId, action: 'agency.site_updated', agencyId, details: { fields: ['address', 'phone'] } },
    { userId, action: 'agency.site_deactivated', agencyId },
    { userId, action: 'agency.site_reactivated', agencyId },
    { userId, action: 'agency.capability_enabled', agencyId, details: { fields: ['delivery'] } },
    { userId, action: 'agency.capability_suspended', agencyId, details: { fields: ['storage'] } },
  ]);
});
