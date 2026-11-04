import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { FixedClock, RecordingEventPublisher, T0, uuid } from '@shared/tests/doubles/fakes';
import { SubmitAgencyHandler } from '../../application/commands/submit-agency/submit-agency.handler';
import { AgencyAlreadySubmitted, AgencyNotFound, AgencySubmissionForbidden, MembershipNotFound, SubmissionIncomplete } from '../../domain/exceptions/agency.exceptions';
import { identityChangeOf } from '../../domain/agency-identity';
import { AGENCY, ADMIN, AGENT, anAgency, InMemoryAgencyRepository, InMemoryAgencyTeamRepository, membership, OTHER_AGENCY, OWNER, withActiveSite, withActiveZone } from '../doubles/fakes';

const FORMER = { user: uuid(4), membership: uuid(24) };
const OUTSIDER = uuid(5);
const NOW = new Date('2026-11-15T09:00:00.000Z');

async function setup(complete = true) {
  const agencies = new InMemoryAgencyRepository();
  const agency = anAgency('draft', 1);
  if (complete) {
    agency.completeIdentity(identityChangeOf({ legalName: 'Express Douala SARL', headquartersCity: 'Douala', headquartersAddress: 'Rue Joss, Akwa', primaryPhone: '677123456' }), UserId.of(OWNER.user), 1);
    withActiveZone(agency, 1, 'Douala', 'Akwa');
    withActiveSite(agency, 1, 'Agence Akwa');
    agency.enableCapability('delivery', UserId.of(OWNER.user), T0);
    agency.pullEvents();
  }
  await agencies.add(agency);
  await agencies.add(anAgency('draft', 1, OTHER_AGENCY));
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'), membership(ADMIN, 'admin'), membership(AGENT, 'agent'), membership(FORMER, 'owner', false));
  const events = new RecordingEventPublisher();
  return { agencies, events, handler: new SubmitAgencyHandler(teams, agencies, new FixedClock(NOW), events) };
}

test('the owner submits a complete agency: it answers with the submission and publishes one event', async () => {
  const { handler, agencies, events } = await setup();
  const result = await handler.handle({ actorId: OWNER.user, agencyId: AGENCY });
  assert.deepEqual(result, { status: 'submitted', submission: { submittedAt: NOW.toISOString(), submittedBy: OWNER.user } });
  assert.equal(agencies.stored(AGENCY)?.status, 'submitted');
  assert.deepEqual(events.published, [{ type: 'AgencySubmittedForVerification', agencyId: AGENCY, actorId: OWNER.user }]);
});

test('an incomplete agency is refused with the full list, nothing saved or published', async () => {
  const { handler, agencies, events } = await setup(false);
  await assert.rejects(handler.handle({ actorId: OWNER.user, agencyId: AGENCY }), (error: unknown) => error instanceof SubmissionIncomplete && error.missing.length === 6);
  assert.equal(agencies.saves, 0);
  assert.equal(agencies.stored(AGENCY)?.status, 'draft');
  assert.deepEqual(events.published, []);
});

test('administrators and agents are forbidden; outsiders, former members and other agencies see the same not found', async () => {
  const { handler, agencies, events } = await setup();
  await assert.rejects(handler.handle({ actorId: ADMIN.user, agencyId: AGENCY }), AgencySubmissionForbidden);
  await assert.rejects(handler.handle({ actorId: AGENT.user, agencyId: AGENCY }), AgencySubmissionForbidden);
  const hidden: [string, string][] = [[OUTSIDER, AGENCY], [FORMER.user, AGENCY], [OWNER.user, OTHER_AGENCY], [OWNER.user, uuid(99)]];
  for (const [actorId, agencyId] of hidden) {
    await assert.rejects(handler.handle({ actorId, agencyId }), (error: unknown) => error instanceof MembershipNotFound || error instanceof AgencyNotFound);
  }
  assert.equal(agencies.saves, 0);
  assert.deepEqual(events.published, []);
});

test('a second submission is a conflict with no second effect', async () => {
  const { handler, agencies, events } = await setup();
  await handler.handle({ actorId: OWNER.user, agencyId: AGENCY });
  await assert.rejects(handler.handle({ actorId: OWNER.user, agencyId: AGENCY }), AgencyAlreadySubmitted);
  assert.equal(agencies.saves, 1);
  assert.equal(events.published.length, 1);
});
