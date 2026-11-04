import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { FixedClock, InMemoryAuditLog, RecordingEventPublisher, SequentialIds, T0, uuid } from '@shared/tests/doubles/fakes';
import { AddServiceZoneHandler } from '../../application/commands/add-service-zone/add-service-zone.handler';
import { CorrectServiceZoneHandler } from '../../application/commands/correct-service-zone/correct-service-zone.handler';
import { RetireServiceZoneHandler } from '../../application/commands/retire-service-zone/retire-service-zone.handler';
import { AgencyAuditSubscriber } from '../../application/subscribers/agency-audit.subscriber';
import { AgencyEvent } from '../../domain/events/agency-events';
import {
  InvalidAgencyField, ServiceZoneAlreadyServed, ServiceZoneNotFound, ServiceZoneRetired, ServiceZoneRetiredDuplicate,
} from '../../domain/exceptions/agency.exceptions';
import { ServiceArea } from '../../domain/value-objects/service-area';
import { ServiceZoneId } from '../../domain/value-objects/service-zone-id';
import { ADMIN, AGENCY, AGENT, anAgency, InMemoryAgencyRepository, InMemoryAgencyTeamRepository, membership, OTHER_AGENCY, OWNER } from '../doubles/fakes';

const FORMER = { user: uuid(4), membership: uuid(24) };
const OUTSIDER = uuid(5);
const kindOf = (kind: string) => (error: unknown) => error instanceof Error && 'kind' in error && error.kind === kind;

async function setup() {
  const agencies = new InMemoryAgencyRepository();
  await agencies.add(anAgency('submitted', 3));
  await agencies.add(anAgency('draft', 1, OTHER_AGENCY));
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'), membership(ADMIN, 'admin'), membership(AGENT, 'agent'), membership(FORMER, 'admin', false));
  const events = new RecordingEventPublisher();
  const clock = new FixedClock(T0);
  const add = new AddServiceZoneHandler(teams, agencies, new SequentialIds(), clock, events);
  const akwa = await add.handle({ actorId: OWNER.user, agencyId: AGENCY, city: 'Douala', district: 'Akwaa' });
  await add.handle({ actorId: OWNER.user, agencyId: AGENCY, city: 'Douala', district: 'Deïdo' });
  const bepanda = await add.handle({ actorId: OWNER.user, agencyId: AGENCY, city: 'Douala', district: 'Bépanda' });
  await new RetireServiceZoneHandler(teams, agencies, clock, events).handle({ actorId: OWNER.user, agencyId: AGENCY, zoneId: bepanda.id });
  events.published.length = 0;
  const locksBefore = teams.locks;
  return { agencies, events, teams, akwa, bepanda, savesBefore: agencies.saves, locksBefore, correct: new CorrectServiceZoneHandler(teams, agencies, events) };
}

const body = (actorId: string, zoneId: string, city = 'Douala', district: string | null = 'Akwa', agencyId = AGENCY) => ({ actorId, agencyId, zoneId, city, district });

test('the owner and an administrator correct a zone and receive it with the same identifier', async () => {
  const { correct, akwa, agencies } = await setup();
  const fixed = await correct.handle(body(ADMIN.user, akwa.id));
  assert.deepEqual(fixed, { id: akwa.id, city: 'Douala', district: 'Akwa', status: 'active', addedAt: T0.toISOString(), retiredAt: null });
  const again = await correct.handle(body(OWNER.user, akwa.id, 'Douala', 'Akwa Nord'));
  assert.equal(again.district, 'Akwa Nord');
  assert.equal(agencies.stored(AGENCY)?.zones.find(zone => zone.id.value === akwa.id)?.area.district, 'Akwa Nord');
});

test('an effective correction saves once and publishes ServiceZoneRenamed with the zone and the field names', async () => {
  const { correct, akwa, events, agencies, savesBefore } = await setup();
  await correct.handle(body(ADMIN.user, akwa.id));
  assert.equal(agencies.saves, savesBefore + 1);
  assert.deepEqual(events.published, [{ type: 'ServiceZoneRenamed', agencyId: AGENCY, actorId: ADMIN.user, zoneId: akwa.id, fields: ['district'] }]);
});

test('a correction that changes nothing answers the zone and saves and publishes nothing', async () => {
  const { correct, akwa, events, agencies, savesBefore } = await setup();
  const same = await correct.handle(body(OWNER.user, akwa.id, ' Douala ', 'Akwaa'));
  assert.deepEqual([same.id, same.district], [akwa.id, 'Akwaa']);
  assert.deepEqual([agencies.saves, events.published.length], [savesBefore, 0]);
});

test('an agent is forbidden; an outsider, a former member, another agency and an unknown zone are not found; nothing is saved or published', async () => {
  const { correct, akwa, events, agencies, savesBefore, teams, locksBefore } = await setup();
  await assert.rejects(correct.handle(body(AGENT.user, akwa.id)), kindOf('forbidden'));
  for (const actor of [OUTSIDER, FORMER.user]) await assert.rejects(correct.handle(body(actor, akwa.id)), kindOf('not_found'));
  await assert.rejects(correct.handle(body(OWNER.user, akwa.id, 'Douala', 'Akwa', OTHER_AGENCY)), kindOf('not_found'));
  await assert.rejects(correct.handle(body(OWNER.user, uuid(999))), ServiceZoneNotFound);
  assert.deepEqual([agencies.saves, events.published.length], [savesBefore, 0]);
  assert.equal(teams.locks - locksBefore, 1, 'only the allowed actor, on a zone that does not exist, took the lock');
});

test('a zone of another agency is looked up in the path agency only, so it is not found', async () => {
  const { correct, agencies } = await setup();
  const foreign = anAgency('draft', 1, OTHER_AGENCY);
  foreign.addZone(ServiceZoneId.of(uuid(777)), ServiceArea.of('Yaoundé', 'Bastos'), UserId.of(OWNER.user), T0);
  await agencies.save(foreign);
  await assert.rejects(correct.handle(body(OWNER.user, uuid(777))), ServiceZoneNotFound);
  assert.equal(agencies.stored(OTHER_AGENCY)?.zones[0]?.area.city, 'Yaoundé');
});

test('duplicates are conflicts: an active zone, a retired zone; and a retired zone cannot be corrected', async () => {
  const { correct, akwa, bepanda, events } = await setup();
  await assert.rejects(correct.handle(body(ADMIN.user, akwa.id, 'douala', 'DEIDO')), ServiceZoneAlreadyServed);
  await assert.rejects(correct.handle(body(ADMIN.user, akwa.id, 'Douala', 'Bépanda')), ServiceZoneRetiredDuplicate);
  await assert.rejects(correct.handle(body(ADMIN.user, bepanda.id, 'Douala', 'Bépanda Omnisport')), ServiceZoneRetired);
  assert.equal(events.published.length, 0);
});

test('invalid text is a 400-kind error and writes nothing', async () => {
  const { correct, akwa, agencies, events, savesBefore } = await setup();
  const refused: readonly (readonly [string, string | null])[] = [['x', 'Akwa'], ['Douala', 'x'], ['Douala', 'Akwa​'], ['Dou\u0000ala', null], ['Douala', 'x'.repeat(81)]];
  for (const [city, district] of refused) await assert.rejects(correct.handle(body(OWNER.user, akwa.id, city, district)), InvalidAgencyField, `${city} / ${district}`);
  assert.deepEqual([agencies.saves, events.published.length], [savesBefore, 0]);
});

test('a blank district means the whole city', async () => {
  const { correct, akwa } = await setup();
  assert.equal((await correct.handle(body(OWNER.user, akwa.id, 'Douala', '  '))).district, null);
});

test('the audit keeps the zone as the resource and the names of the changed fields, never the spelling', async () => {
  const audit = new InMemoryAuditLog();
  const event: AgencyEvent = { type: 'ServiceZoneRenamed', agencyId: AGENCY, actorId: ADMIN.user, zoneId: uuid(501), fields: ['city', 'district'] };
  await new AgencyAuditSubscriber(audit).handle(event);
  assert.deepEqual(audit.entries, [{ userId: ADMIN.user, action: 'agency.zone_renamed', agencyId: AGENCY, resourceId: uuid(501), details: { fields: ['city', 'district'] } }]);
});
