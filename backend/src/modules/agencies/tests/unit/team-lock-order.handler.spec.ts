import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AddServiceZoneHandler } from '../../application/commands/add-service-zone/add-service-zone.handler';
import { ChangeMemberRoleHandler } from '../../application/commands/change-member-role/change-member-role.handler';
import { IssueInvitationHandler } from '../../application/commands/issue-invitation/issue-invitation.handler';
import { RevokeMembershipHandler } from '../../application/commands/revoke-membership/revoke-membership.handler';
import { SubmitAgencyHandler } from '../../application/commands/submit-agency/submit-agency.handler';
import { UpdateAgencyIdentityHandler } from '../../application/commands/update-agency-identity/update-agency-identity.handler';
import { UpdateAgencyProfileHandler } from '../../application/commands/update-agency-profile/update-agency-profile.handler';
import { DomainException } from '@shared/domain/exceptions/domain.exception';
import { DeterministicTokenSecrets, FixedClock, RecordingEventPublisher, SequentialIds, T0, uuid } from '@shared/tests/doubles/fakes';
import { ADMIN, AGENCY, AGENT, anAgency, InMemoryAgencyRepository, InMemoryAgencyTeamRepository, InMemoryInvitationRepository, membership, OWNER } from '../doubles/fakes';

const FORMER = { user: uuid(4), membership: uuid(24) };
const OUTSIDER = uuid(5);

async function setup() {
  const agencies = new InMemoryAgencyRepository();
  await agencies.add(anAgency('draft', 1));
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'), membership(ADMIN, 'admin'), membership(AGENT, 'agent'), membership(FORMER, 'admin', false));
  const events = new RecordingEventPublisher();
  const clock = new FixedClock(T0);
  const writes: Readonly<Record<string, (actorId: string) => Promise<unknown>>> = {
    'add a zone': actorId => new AddServiceZoneHandler(teams, agencies, new SequentialIds(), clock, events).handle({ actorId, agencyId: AGENCY, city: 'Douala', district: null }),
    'update the identity': actorId => new UpdateAgencyIdentityHandler(teams, agencies, events).handle({ actorId, agencyId: AGENCY, expectedVersion: 1, changes: { legalName: 'Express Douala SARL' } }),
    'update the profile': actorId => new UpdateAgencyProfileHandler(teams, agencies, events).handle({ actorId, agencyId: AGENCY, expectedVersion: 1, changes: { description: 'Livraison rapide' } }),
    'submit the agency': actorId => new SubmitAgencyHandler(teams, agencies, clock, events).handle({ actorId, agencyId: AGENCY }),
    'invite a member': actorId => new IssueInvitationHandler(teams, new InMemoryInvitationRepository(), new DeterministicTokenSecrets(), new SequentialIds(), clock, events).handle({ actorId, agencyId: AGENCY, email: 'a@example.com', role: 'agent' }),
    'change a role': actorId => new ChangeMemberRoleHandler(teams, events).handle({ actorId, agencyId: AGENCY, membershipId: AGENT.membership, role: 'admin' }),
    'revoke a member': actorId => new RevokeMembershipHandler(teams, events).handle({ actorId, agencyId: AGENCY, membershipId: AGENT.membership }),
  };
  return { teams, writes };
}

test('an outsider or a former member is told "not found" before the agency row is ever locked', async () => {
  for (const action of Object.keys((await setup()).writes)) {
    for (const actor of [OUTSIDER, FORMER.user]) {
      const { teams, writes } = await setup();
      await assert.rejects(writes[action]?.(actor) ?? Promise.reject(new Error('unknown action')), (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'not_found', `${action} by ${actor}`);
      assert.equal(teams.locks, 0, `${action}: no lock for an outsider`);
    }
  }
});

test('a member whose role does not allow the action is refused before the lock too', async () => {
  const forbidden: readonly (readonly [string, string])[] = [
    ['add a zone', AGENT.user], ['update the identity', AGENT.user], ['update the profile', AGENT.user], ['submit the agency', AGENT.user], ['submit the agency', ADMIN.user],
    ['invite a member', AGENT.user], ['change a role', AGENT.user], ['revoke a member', AGENT.user],
  ];
  for (const [action, actor] of forbidden) {
    const { teams, writes } = await setup();
    await assert.rejects(writes[action]?.(actor) ?? Promise.reject(new Error('unknown action')), (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'forbidden', `${action} by ${actor}`);
    assert.equal(teams.locks, 0, `${action}: no lock for a refused role`);
  }
});

test('an allowed actor takes the lock once, after the check, whatever the domain then answers', async () => {
  for (const action of Object.keys((await setup()).writes)) {
    const { teams, writes } = await setup();
    await writes[action]?.(OWNER.user).catch((error: unknown) => { if (!(error instanceof DomainException)) throw error; });
    assert.equal(teams.locks, 1, action);
  }
});
