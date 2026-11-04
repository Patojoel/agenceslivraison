import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecordingEventPublisher, uuid } from '@shared/tests/doubles/fakes';
import { UpdateAgencyIdentityHandler } from '../../application/commands/update-agency-identity/update-agency-identity.handler';
import { UpdateAgencyProfileHandler } from '../../application/commands/update-agency-profile/update-agency-profile.handler';
import { AgencyNotFound, AgencyIdentityLocked, InvalidAgencyField, StaleAgencyVersion } from '../../domain/exceptions/agency.exceptions';
import { AGENCY, ADMIN, AGENT, anAgency, InMemoryAgencyRepository, InMemoryAgencyTeamRepository, membership, OTHER_AGENCY, OWNER } from '../doubles/fakes';

const FORMER = { user: uuid(4), membership: uuid(24) };
const OUTSIDER = uuid(5);

async function setup(status: 'draft' | 'submitted' = 'draft', version = 3) {
  const agencies = new InMemoryAgencyRepository();
  await agencies.add(anAgency(status, version));
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'), membership(ADMIN, 'admin'), membership(AGENT, 'agent'), membership(FORMER, 'admin', false));
  const events = new RecordingEventPublisher();
  return { agencies, events, identity: new UpdateAgencyIdentityHandler(teams, agencies, events), profile: new UpdateAgencyProfileHandler(teams, agencies, events) };
}

const identityCommand = (actorId: string, changes: Record<string, string | null> = { primaryPhone: '6 77 12 34 56' }, expectedVersion = 3, agencyId = AGENCY) =>
  ({ actorId, agencyId, expectedVersion, changes });
const profileCommand = (actorId: string, changes: Record<string, string | null> = { description: 'Livraison express' }, expectedVersion = 3, agencyId = AGENCY) =>
  ({ actorId, agencyId, expectedVersion, changes });

test('the owner and an administrator can complete the identity; the answer carries the new version and the stored values', async () => {
  const { agencies, identity } = await setup();
  const first = await identity.handle(identityCommand(OWNER.user, { legalName: ' Express  Douala SARL ', primaryPhone: '6 77 12 34 56' }));
  assert.deepEqual(first, {
    version: 4,
    identity: { legalName: 'Express Douala SARL', headquartersCity: null, headquartersAddress: null, primaryPhone: '+237677123456', contactEmail: null, rccm: null, niu: null },
  });
  const second = await identity.handle(identityCommand(ADMIN.user, { headquartersCity: 'Douala' }, 4));
  assert.equal(second.version, 5);
  assert.equal(second.identity.legalName, 'Express Douala SARL');
  assert.equal(agencies.stored(AGENCY)?.version, 5);
});

test('an agent is forbidden and nothing is written', async () => {
  const { agencies, events, identity, profile } = await setup();
  await assert.rejects(identity.handle(identityCommand(AGENT.user)), (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'forbidden');
  await assert.rejects(profile.handle(profileCommand(AGENT.user)), (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'forbidden');
  assert.deepEqual([agencies.saves, events.published.length, agencies.stored(AGENCY)?.version], [0, 0, 3]);
});

test('an outsider, a former member and an unknown agency all answer not found, whatever the body', async () => {
  const { agencies, events, identity, profile } = await setup();
  const notFound = (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'not_found';
  for (const actor of [OUTSIDER, FORMER.user]) {
    await assert.rejects(identity.handle(identityCommand(actor)), notFound);
    await assert.rejects(profile.handle(profileCommand(actor)), notFound);
    await assert.rejects(identity.handle(identityCommand(actor, { primaryPhone: 'not a phone' })), notFound);
  }
  await assert.rejects(identity.handle(identityCommand(OWNER.user, { primaryPhone: '6 77 12 34 56' }, 3, OTHER_AGENCY)), notFound);
  await assert.rejects(profile.handle(profileCommand(OWNER.user, { description: 'x' }, 3, OTHER_AGENCY)), notFound);
  assert.deepEqual([agencies.saves, events.published.length], [0, 0]);
});

test('a team whose agency row is missing is reported as an unknown agency', async () => {
  const { identity } = await setup();
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'));
  const orphan = new UpdateAgencyIdentityHandler(teams, new InMemoryAgencyRepository(), new RecordingEventPublisher());
  await assert.rejects(orphan.handle(identityCommand(OWNER.user)), AgencyNotFound);
  assert.ok(identity);
});

test('a stale version is a conflict and nothing is written or published', async () => {
  const { agencies, events, identity, profile } = await setup('draft', 4);
  await assert.rejects(identity.handle(identityCommand(ADMIN.user, { headquartersCity: 'Douala' }, 3)), StaleAgencyVersion);
  await assert.rejects(profile.handle(profileCommand(ADMIN.user, { description: 'Ancienne présentation' }, 3)), StaleAgencyVersion);
  assert.deepEqual([agencies.saves, events.published.length, agencies.stored(AGENCY)?.version], [0, 0, 4]);
});

test('a submitted agency refuses an identity change but accepts a profile change', async () => {
  const { agencies, identity, profile } = await setup('submitted', 5);
  await assert.rejects(identity.handle(identityCommand(OWNER.user, { legalName: 'Express Cameroun SARL' }, 5)), AgencyIdentityLocked);
  assert.equal(agencies.stored(AGENCY)?.version, 5);
  const result = await profile.handle(profileCommand(OWNER.user, { description: 'Livraison et stockage à Douala' }, 5));
  assert.deepEqual(result, { version: 6, tradeName: 'Express Douala', description: 'Livraison et stockage à Douala' });
  assert.equal(agencies.stored(AGENCY)?.status, 'submitted');
});

test('an invalid field is a bad request, writes nothing, and leaves the stored agency as it was', async () => {
  const { agencies, events, identity, profile } = await setup();
  await assert.rejects(identity.handle(identityCommand(OWNER.user, { primaryPhone: '5 77 12 34 56' })), InvalidAgencyField);
  await assert.rejects(identity.handle(identityCommand(OWNER.user, { legalName: null })), InvalidAgencyField);
  await assert.rejects(identity.handle(identityCommand(OWNER.user, { legalName: 'Express Douala SARL', niu: 'short' })), InvalidAgencyField);
  await assert.rejects(profile.handle(profileCommand(OWNER.user, { description: 'x'.repeat(1001) })), InvalidAgencyField);
  await assert.rejects(profile.handle(profileCommand(OWNER.user, { tradeName: '' })), Error);
  assert.deepEqual([agencies.saves, events.published.length, agencies.stored(AGENCY)?.identity.legalName], [0, 0, null]);
});

test('the identity event lists the changed field names and never their values', async () => {
  const { events, identity } = await setup();
  await identity.handle(identityCommand(ADMIN.user, { primaryPhone: '6 99 00 11 22', rccm: 'RC/DLA/2020/B/1234' }));
  assert.deepEqual(events.published, [{ type: 'AgencyIdentityUpdated', agencyId: AGENCY, actorId: ADMIN.user, fields: ['primaryPhone', 'rccm'] }]);
  const serialized = JSON.stringify(events.published);
  assert.ok(!serialized.includes('+237699001122') && !serialized.includes('6 99 00 11 22') && !serialized.includes('RC/DLA'));
});

test('the profile event lists the changed field names and never their values', async () => {
  const { events, profile } = await setup();
  await profile.handle(profileCommand(ADMIN.user, { description: 'Livraison express dans Douala' }));
  assert.deepEqual(events.published, [{ type: 'AgencyProfileUpdated', agencyId: AGENCY, actorId: ADMIN.user, fields: ['description'] }]);
  assert.ok(!JSON.stringify(events.published).includes('Livraison'));
});

test('a request that changes nothing succeeds without write, event or new version', async () => {
  const { agencies, events, identity, profile } = await setup();
  await identity.handle(identityCommand(OWNER.user, { primaryPhone: '6 77 12 34 56' }));
  events.published.length = 0;
  const savesBefore = agencies.saves;
  assert.deepEqual((await identity.handle(identityCommand(OWNER.user, { primaryPhone: '677123456' }, 4))).version, 4);
  assert.deepEqual((await identity.handle(identityCommand(OWNER.user, {}, 4))).version, 4);
  assert.deepEqual(await profile.handle(profileCommand(OWNER.user, { tradeName: ' Express Douala ', description: null }, 4)), { version: 4, tradeName: 'Express Douala', description: null });
  assert.deepEqual([agencies.saves, events.published.length], [savesBefore, 0]);
});

test('the description can be cleared through the profile', async () => {
  const { profile } = await setup();
  await profile.handle(profileCommand(OWNER.user, { description: 'Livraison express' }));
  const result = await profile.handle(profileCommand(OWNER.user, { description: null }, 4));
  assert.deepEqual(result, { version: 5, tradeName: 'Express Douala', description: null });
});
