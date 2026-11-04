import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { ServiceArea } from '../../domain/value-objects/service-area';
import { ServiceZoneId } from '../../domain/value-objects/service-zone-id';
import { FixedClock, RecordingEventPublisher, SequentialIds, T0, uuid } from '@shared/tests/doubles/fakes';
import { AddServiceZoneHandler } from '../../application/commands/add-service-zone/add-service-zone.handler';
import { CreateAgencySiteHandler } from '../../application/commands/create-agency-site/create-agency-site.handler';
import { DeactivateAgencySiteHandler } from '../../application/commands/deactivate-agency-site/deactivate-agency-site.handler';
import { EnableCapabilityHandler } from '../../application/commands/enable-capability/enable-capability.handler';
import { ReactivateAgencySiteHandler } from '../../application/commands/reactivate-agency-site/reactivate-agency-site.handler';
import { RetireServiceZoneHandler } from '../../application/commands/retire-service-zone/retire-service-zone.handler';
import { SuspendCapabilityHandler } from '../../application/commands/suspend-capability/suspend-capability.handler';
import { UpdateAgencySiteHandler } from '../../application/commands/update-agency-site/update-agency-site.handler';
import {
  AgencyNotFound, CapabilityPrerequisiteMissing, InvalidAgencyField, LastActiveSite, LastActiveZone, ServiceZoneAlreadyServed, ServiceZoneNotFound, StaleSiteVersion,
} from '../../domain/exceptions/agency.exceptions';
import { AGENCY, ADMIN, AGENT, anAgency, InMemoryAgencyRepository, InMemoryAgencyTeamRepository, membership, OTHER_AGENCY, OWNER } from '../doubles/fakes';

const FORMER = { user: uuid(4), membership: uuid(24) };
const OUTSIDER = uuid(5);
const AKWA = { name: 'Agence Akwa', city: 'Douala', address: 'Rue Joss, face Total Akwa', phone: null };

async function setup(status: 'draft' | 'submitted' = 'draft') {
  const agencies = new InMemoryAgencyRepository();
  await agencies.add(anAgency(status, 3));
  await agencies.add(anAgency(status, 1, OTHER_AGENCY));
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'), membership(ADMIN, 'admin'), membership(AGENT, 'agent'), membership(FORMER, 'admin', false));
  const events = new RecordingEventPublisher();
  const ids = new SequentialIds();
  const clock = new FixedClock(T0);
  return {
    agencies, events,
    addZone: new AddServiceZoneHandler(teams, agencies, ids, clock, events),
    retireZone: new RetireServiceZoneHandler(teams, agencies, clock, events),
    createSite: new CreateAgencySiteHandler(teams, agencies, ids, clock, events),
    updateSite: new UpdateAgencySiteHandler(teams, agencies, events),
    deactivateSite: new DeactivateAgencySiteHandler(teams, agencies, clock, events),
    reactivateSite: new ReactivateAgencySiteHandler(teams, agencies, events),
    enable: new EnableCapabilityHandler(teams, agencies, clock, events),
    suspend: new SuspendCapabilityHandler(teams, agencies, clock, events),
  };
}

const kindOf = (kind: string) => (error: unknown) => error instanceof Error && 'kind' in error && error.kind === kind;
const zone = (actorId: string, city = 'Douala', district: string | null = 'Akwa', agencyId = AGENCY) => ({ actorId, agencyId, city, district });

test('the owner and an administrator add a zone and receive it, active, with its identifier', async () => {
  const { addZone, agencies } = await setup();
  const first = await addZone.handle(zone(OWNER.user));
  assert.deepEqual(first, { id: uuid(1000), city: 'Douala', district: 'Akwa', status: 'active', addedAt: T0.toISOString(), retiredAt: null });
  const second = await addZone.handle(zone(ADMIN.user, 'Yaoundé', null));
  assert.deepEqual([second.district, second.status], [null, 'active']);
  assert.equal(agencies.stored(AGENCY)?.zones.length, 2);
});

test('adding a retired zone again gives back the same zone, active', async () => {
  const { addZone, retireZone } = await setup();
  const added = await addZone.handle(zone(OWNER.user));
  await retireZone.handle({ actorId: OWNER.user, agencyId: AGENCY, zoneId: added.id });
  const back = await addZone.handle(zone(ADMIN.user, 'douala', 'AKWA'));
  assert.deepEqual([back.id, back.status, back.retiredAt], [added.id, 'active', null]);
});

test('retiring a zone answers with the retired zone', async () => {
  const { addZone, retireZone } = await setup();
  const added = await addZone.handle(zone(OWNER.user));
  const retired = await retireZone.handle({ actorId: ADMIN.user, agencyId: AGENCY, zoneId: added.id });
  assert.deepEqual([retired.status, retired.retiredAt], ['retired', T0.toISOString()]);
});

test('an agent is forbidden on every write and nothing is saved or published', async () => {
  const { agencies, events, ...handlers } = await setup();
  const writes = [
    handlers.addZone.handle(zone(AGENT.user)),
    handlers.retireZone.handle({ actorId: AGENT.user, agencyId: AGENCY, zoneId: uuid(501) }),
    handlers.createSite.handle({ actorId: AGENT.user, agencyId: AGENCY, ...AKWA }),
    handlers.updateSite.handle({ actorId: AGENT.user, agencyId: AGENCY, siteId: uuid(601), expectedVersion: 1, changes: { city: 'Kribi' } }),
    handlers.deactivateSite.handle({ actorId: AGENT.user, agencyId: AGENCY, siteId: uuid(601) }),
    handlers.reactivateSite.handle({ actorId: AGENT.user, agencyId: AGENCY, siteId: uuid(601) }),
    handlers.enable.handle({ actorId: AGENT.user, agencyId: AGENCY, capability: 'delivery' }),
    handlers.suspend.handle({ actorId: AGENT.user, agencyId: AGENCY, capability: 'delivery', reason: 'Inventaire annuel' }),
  ];
  for (const write of writes) await assert.rejects(write, kindOf('forbidden'));
  assert.deepEqual([agencies.saves, events.published.length], [0, 0]);
});

test('an outsider, a former member and an unknown agency all answer not found, whatever the body', async () => {
  const { agencies, events, ...handlers } = await setup();
  for (const actor of [OUTSIDER, FORMER.user]) {
    await assert.rejects(handlers.addZone.handle(zone(actor)), kindOf('not_found'));
    await assert.rejects(handlers.addZone.handle(zone(actor, 'x')), kindOf('not_found'));
    await assert.rejects(handlers.retireZone.handle({ actorId: actor, agencyId: AGENCY, zoneId: uuid(501) }), kindOf('not_found'));
    await assert.rejects(handlers.createSite.handle({ actorId: actor, agencyId: AGENCY, ...AKWA, name: '' }), kindOf('not_found'));
    await assert.rejects(handlers.enable.handle({ actorId: actor, agencyId: AGENCY, capability: 'delivery' }), kindOf('not_found'));
    await assert.rejects(handlers.suspend.handle({ actorId: actor, agencyId: AGENCY, capability: 'delivery', reason: 'x' }), kindOf('not_found'));
  }
  await assert.rejects(handlers.addZone.handle(zone(OWNER.user, 'Douala', 'Akwa', uuid(99))), kindOf('not_found'));
  await assert.rejects(handlers.addZone.handle(zone(OWNER.user, 'Douala', 'Akwa', OTHER_AGENCY)), kindOf('not_found'));
  assert.deepEqual([agencies.saves, events.published.length], [0, 0]);
});

test('a team whose agency row is missing is reported as an unknown agency', async () => {
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'));
  const orphan = new AddServiceZoneHandler(teams, new InMemoryAgencyRepository(), new SequentialIds(), new FixedClock(), new RecordingEventPublisher());
  await assert.rejects(orphan.handle(zone(OWNER.user)), AgencyNotFound);
});

test('a zone of another agency is not found: the identifier is only looked up in the path agency', async () => {
  const { agencies, retireZone, addZone } = await setup();
  const foreign = anAgency('draft', 1, OTHER_AGENCY);
  foreign.addZone(...foreignZone());
  await agencies.save(foreign);
  await addZone.handle(zone(OWNER.user));
  await assert.rejects(retireZone.handle({ actorId: OWNER.user, agencyId: AGENCY, zoneId: uuid(777) }), ServiceZoneNotFound);
  assert.equal(agencies.stored(OTHER_AGENCY)?.zones[0]?.retiredAt, null);
});

test('invalid input is a 400-kind error and writes nothing', async () => {
  const { agencies, events, addZone, createSite, suspend } = await setup();
  await assert.rejects(addZone.handle(zone(OWNER.user, 'x')), InvalidAgencyField);
  await assert.rejects(createSite.handle({ actorId: OWNER.user, agencyId: AGENCY, ...AKWA, phone: '123' }), InvalidAgencyField);
  await assert.rejects(suspend.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'delivery', reason: 'ok' }), InvalidAgencyField);
  await assert.rejects(suspend.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'transport aérien', reason: 'Inventaire annuel' }), InvalidAgencyField);
  assert.deepEqual([agencies.saves, events.published.length], [0, 0]);
});

test('a duplicate zone is a conflict and writes nothing more', async () => {
  const { agencies, events, addZone } = await setup();
  await addZone.handle(zone(OWNER.user));
  await assert.rejects(addZone.handle(zone(ADMIN.user, 'DOUALA', 'akwa')), ServiceZoneAlreadyServed);
  assert.deepEqual([agencies.saves, events.published.length], [1, 1]);
});

test('every effective action publishes exactly one event, a refusal publishes none', async () => {
  const { events, addZone, retireZone, createSite, updateSite, deactivateSite, reactivateSite, enable, suspend } = await setup('submitted');
  const added = await addZone.handle(zone(OWNER.user));
  const site = await createSite.handle({ actorId: ADMIN.user, agencyId: AGENCY, ...AKWA });
  await updateSite.handle({ actorId: ADMIN.user, agencyId: AGENCY, siteId: site.id, expectedVersion: 1, changes: { address: 'Rue Joss, immeuble Bleu' } });
  await updateSite.handle({ actorId: ADMIN.user, agencyId: AGENCY, siteId: site.id, expectedVersion: 2, changes: { address: 'Rue Joss, immeuble Bleu' } });
  await deactivateSite.handle({ actorId: ADMIN.user, agencyId: AGENCY, siteId: site.id });
  await reactivateSite.handle({ actorId: ADMIN.user, agencyId: AGENCY, siteId: site.id });
  await enable.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'storage' });
  await assert.rejects(enable.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'storage' }));
  await suspend.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'storage', reason: 'Inventaire annuel' });
  await retireZone.handle({ actorId: OWNER.user, agencyId: AGENCY, zoneId: added.id });
  assert.deepEqual(events.types(), [
    'ServiceZoneAdded', 'AgencySiteCreated', 'AgencySiteUpdated', 'AgencySiteDeactivated', 'AgencySiteReactivated', 'AgencyCapabilityEnabled', 'AgencyCapabilitySuspended', 'ServiceZoneRetired',
  ]);
});

test('a site is created, edited under its own version, deactivated and reactivated; the answers carry the site', async () => {
  const { createSite, updateSite, deactivateSite, reactivateSite, agencies } = await setup();
  const site = await createSite.handle({ actorId: OWNER.user, agencyId: AGENCY, ...AKWA, phone: '6 77 12 34 56' });
  assert.deepEqual(site, { id: uuid(1000), name: 'Agence Akwa', city: 'Douala', address: 'Rue Joss, face Total Akwa', phone: '+237677123456', status: 'active', createdAt: T0.toISOString(), deactivatedAt: null, version: 1 });
  const edited = await updateSite.handle({ actorId: ADMIN.user, agencyId: AGENCY, siteId: site.id, expectedVersion: 1, changes: { phone: null } });
  assert.deepEqual([edited.version, edited.phone], [2, null]);
  const off = await deactivateSite.handle({ actorId: OWNER.user, agencyId: AGENCY, siteId: site.id });
  assert.deepEqual([off.status, off.deactivatedAt, off.version], ['inactive', T0.toISOString(), 3]);
  const on = await reactivateSite.handle({ actorId: OWNER.user, agencyId: AGENCY, siteId: site.id });
  assert.deepEqual([on.status, on.deactivatedAt, on.version], ['active', null, 4]);
  assert.equal(agencies.stored(AGENCY)?.version, 3, 'the agency version never moved');
});

test('a stale site version is a conflict and nothing is saved', async () => {
  const { createSite, updateSite, agencies } = await setup();
  const site = await createSite.handle({ actorId: OWNER.user, agencyId: AGENCY, ...AKWA });
  const savesBefore = agencies.saves;
  await assert.rejects(updateSite.handle({ actorId: OWNER.user, agencyId: AGENCY, siteId: site.id, expectedVersion: 2, changes: { city: 'Kribi' } }), StaleSiteVersion);
  assert.equal(agencies.saves, savesBefore);
});

test('a site of another agency is not found', async () => {
  const { updateSite, deactivateSite } = await setup();
  await assert.rejects(updateSite.handle({ actorId: OWNER.user, agencyId: AGENCY, siteId: uuid(777), expectedVersion: 1, changes: { city: 'Kribi' } }), kindOf('not_found'));
  await assert.rejects(deactivateSite.handle({ actorId: OWNER.user, agencyId: AGENCY, siteId: uuid(777) }), kindOf('not_found'));
});

test('capabilities: enabling needs the minimal configuration, then answers with every capability and the hybrid flag', async () => {
  const { enable, addZone, createSite, suspend } = await setup();
  await assert.rejects(enable.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'delivery' }), CapabilityPrerequisiteMissing);
  await addZone.handle(zone(OWNER.user));
  const first = await enable.handle({ actorId: ADMIN.user, agencyId: AGENCY, capability: 'delivery' });
  assert.deepEqual(first, { capabilities: [{ type: 'delivery', state: 'active', since: T0.toISOString(), reason: null, acceptsNewRequests: true }], hybrid: false });
  await createSite.handle({ actorId: OWNER.user, agencyId: AGENCY, ...AKWA });
  const both = await enable.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'storage' });
  assert.deepEqual([both.capabilities.map(item => item.type), both.hybrid], [['delivery', 'storage'], true]);
  const suspended = await suspend.handle({ actorId: ADMIN.user, agencyId: AGENCY, capability: 'storage', reason: ' Inventaire annuel ' });
  assert.deepEqual([suspended.hybrid, suspended.capabilities.find(item => item.type === 'storage')?.reason], [false, 'Inventaire annuel']);
});

test('the cross invariants reach the handlers: the last zone and the last site stay while their capability is active', async () => {
  const { addZone, retireZone, createSite, deactivateSite, enable } = await setup();
  const added = await addZone.handle(zone(OWNER.user));
  const site = await createSite.handle({ actorId: OWNER.user, agencyId: AGENCY, ...AKWA });
  await enable.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'delivery' });
  await enable.handle({ actorId: OWNER.user, agencyId: AGENCY, capability: 'storage' });
  await assert.rejects(retireZone.handle({ actorId: OWNER.user, agencyId: AGENCY, zoneId: added.id }), LastActiveZone);
  await assert.rejects(deactivateSite.handle({ actorId: OWNER.user, agencyId: AGENCY, siteId: site.id }), LastActiveSite);
});

function foreignZone(): [ServiceZoneId, ServiceArea, UserId, Date] {
  return [ServiceZoneId.of(uuid(777)), ServiceArea.of('Yaoundé', 'Bastos'), UserId.of(uuid(1)), T0];
}
