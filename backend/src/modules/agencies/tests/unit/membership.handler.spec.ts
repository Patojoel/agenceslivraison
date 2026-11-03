import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChangeMemberRoleHandler } from '../../application/commands/change-member-role/change-member-role.handler';
import { RevokeMembershipHandler } from '../../application/commands/revoke-membership/revoke-membership.handler';
import { MembershipForbidden, MembershipNotFound } from '../../domain/exceptions/agency.exceptions';
import { at, RecordingEventPublisher } from '@shared/tests/doubles/fakes';
import { AGENCY, AGENT, InMemoryAgencyTeamRepository, membership, OTHER_AGENCY, OWNER } from '../doubles/fakes';

function setup() {
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'), membership(AGENT, 'agent'));
  const events = new RecordingEventPublisher();
  return { teams, events, change: new ChangeMemberRoleHandler(teams, events), revoke: new RevokeMembershipHandler(teams, events) };
}

test('changing a role persists it and publishes MembershipRoleChanged', async () => {
  const { teams, events, change } = setup();
  assert.deepEqual(await change.handle({ actorId: OWNER.user, agencyId: AGENCY, membershipId: AGENT.membership, role: 'admin' }), { success: true });
  assert.equal(at(teams.memberships(), 1).role, 'admin');
  assert.deepEqual(events.published, [{ type: 'MembershipRoleChanged', agencyId: AGENCY, actorId: OWNER.user, subjectUserId: AGENT.user }]);
});

test('revoking persists the deactivation and publishes MembershipRevoked', async () => {
  const { teams, events, revoke } = setup();
  await revoke.handle({ actorId: OWNER.user, agencyId: AGENCY, membershipId: AGENT.membership });
  assert.equal(at(teams.memberships(), 1).active, false);
  assert.deepEqual(events.types(), ['MembershipRevoked']);
});

test('a refused change leaves the team untouched and publishes nothing', async () => {
  const { teams, events, change, revoke } = setup();
  await assert.rejects(change.handle({ actorId: AGENT.user, agencyId: AGENCY, membershipId: OWNER.membership, role: 'agent' }), MembershipForbidden);
  await assert.rejects(revoke.handle({ actorId: OWNER.user, agencyId: OTHER_AGENCY, membershipId: AGENT.membership }), MembershipNotFound);
  assert.deepEqual(teams.memberships(), [membership(OWNER, 'owner'), membership(AGENT, 'agent')]);
  assert.deepEqual(events.published, []);
});
