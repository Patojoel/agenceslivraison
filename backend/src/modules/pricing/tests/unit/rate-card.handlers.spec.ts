import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedClock, InMemoryAuditLog, RecordingEventPublisher, SequentialIds, T0, uuid } from '@shared/tests/doubles/fakes';
import { CreateRateCardHandler } from '../../application/commands/create-rate-card/create-rate-card.handler';
import { PublishRateCardVersionHandler } from '../../application/commands/publish-rate-card-version/publish-rate-card-version.handler';
import { PricingAuditSubscriber } from '../../application/subscribers/pricing-audit.subscriber';
import { PricingZoneRetired, RateCardAlreadyExists, StaleRateCardVersion } from '../../domain/exceptions/pricing.exceptions';
import {
  ADMIN, AGENCY, AGENT, AKWA, AKWA_TIERS, BONABERI, BONABERI_TIERS, DEIDO, FakeAgencyAccess, FOREIGN_ZONE, FORMER, InMemoryRateCardStore,
  OTHER_AGENCY, OTHER_OWNER, OUTSIDER, OWNER, RETIRED_ZONE, scale,
} from '../doubles/fakes';

const kindOf = (kind: string) => (error: unknown) => error instanceof Error && 'kind' in error && error.kind === kind;

function setup() {
  const access = new FakeAgencyAccess();
  const store = new InMemoryRateCardStore();
  const events = new RecordingEventPublisher();
  const clock = new FixedClock(T0);
  const create = new CreateRateCardHandler(access, store, new SequentialIds(), clock, events);
  const publish = new PublishRateCardVersionHandler(access, store, clock, events);
  return { access, store, events, create, publish, clock };
}
const createBody = (actorId = OWNER, body = scale(), agencyId = AGENCY) => ({ actorId, agencyId, ...body });
const publishBody = (expectedVersion: number, body = scale(), actorId = OWNER, agencyId = AGENCY) => ({ actorId, agencyId, expectedVersion, ...body });

test('the owner and an administrator create the rate card: version 1, in force, with the zone labels', async () => {
  for (const actor of [OWNER, ADMIN]) {
    const { create } = setup();
    const card = await create.handle(createBody(actor));
    assert.equal(card.version.number, 1);
    assert.equal(card.version.currency, 'XAF');
    assert.equal(card.version.createdBy, actor);
    assert.equal(card.version.createdAt, T0.toISOString());
    assert.deepEqual(card.version.zones.map(zone => [zone.zoneId, zone.city, zone.district, zone.zoneStatus]), [[AKWA, 'Douala', 'Akwa', 'active'], [BONABERI, 'Douala', 'Bonabéri', 'active']]);
    assert.deepEqual(card.version.zones[0]?.tiers, [{ upToGrams: 1000, price: 1000 }, { upToGrams: 5000, price: 1500 }, { upToGrams: 10_000, price: 2500 }, { upToGrams: 30_000, price: 5000 }]);
  }
});

test('creating publishes RateCardCreated once and writes once', async () => {
  const { create, events, store } = setup();
  const card = await create.handle(createBody());
  assert.deepEqual(events.published, [{ type: 'RateCardCreated', agencyId: AGENCY, rateCardId: card.id, actorId: OWNER, version: 1 }]);
  assert.equal(store.adds, 1);
});

test('a draft agency or one without the delivery capability can prepare its rate card', async () => {
  const { create, access } = setup();
  access.deliveryState = async () => ({ deliveryActive: false, zones: [{ id: AKWA, city: 'Douala', district: 'Akwa', active: true }] });
  access.deliveryStateLockedShared = async () => access.deliveryState(AGENCY);
  assert.equal((await create.handle(createBody(OWNER, scale([{ zoneId: AKWA, tiers: AKWA_TIERS }])))).version.number, 1);
});

test('a second rate card is a conflict, and the first stays in version 1', async () => {
  const { create, store } = setup();
  await create.handle(createBody());
  await assert.rejects(create.handle(createBody(ADMIN)), RateCardAlreadyExists);
  assert.deepEqual(store.versionNumbers(AGENCY), [1]);
});

test('an agent is forbidden; an outsider, a former member and the owner of another agency do not find the agency; nothing is written and nobody takes the lock', async () => {
  const { create, store, events, access } = setup();
  await assert.rejects(create.handle(createBody(AGENT)), kindOf('forbidden'));
  for (const actor of [OUTSIDER, FORMER, OTHER_OWNER]) await assert.rejects(create.handle(createBody(actor)), kindOf('not_found'));
  await assert.rejects(create.handle(createBody(OWNER, scale(), uuid(999))), kindOf('not_found'));
  assert.deepEqual([store.adds, events.published.length, access.sharedLocks], [0, 0, 0]);
});

test('the zones are checked against the agency: unknown or foreign is not found, retired is a conflict, nothing is written', async () => {
  const { create, store, events } = setup();
  await assert.rejects(create.handle(createBody(OWNER, scale([{ zoneId: FOREIGN_ZONE, tiers: AKWA_TIERS }]))), kindOf('not_found'));
  await assert.rejects(create.handle(createBody(OWNER, scale([{ zoneId: RETIRED_ZONE, tiers: AKWA_TIERS }]))), PricingZoneRetired);
  assert.deepEqual([store.adds, events.published.length], [0, 0]);
});

test('an invalid scale is refused as invalid, after the rights are checked', async () => {
  const { create, store } = setup();
  await assert.rejects(create.handle(createBody(OWNER, scale([{ zoneId: AKWA, tiers: [{ upTo: '5', price: 1000 }] }]))), kindOf('invalid'));
  await assert.rejects(create.handle(createBody(AGENT, scale([{ zoneId: AKWA, tiers: [{ upTo: '5', price: 1000 }] }]))), kindOf('forbidden'));
  await assert.rejects(create.handle(createBody(OUTSIDER, scale([]))), kindOf('not_found'));
  assert.equal(store.adds, 0);
});

test('the role is decided again under the lock: a member removed while waiting is refused', async () => {
  const { create, access, store } = setup();
  access.onLock = () => access.setRole(AGENCY, OWNER, null);
  await assert.rejects(create.handle(createBody()), kindOf('not_found'));
  assert.equal(store.adds, 0);
});

test('a new version on the version in force is in force at once and the previous one is kept as it was', async () => {
  const { create, publish, store } = setup();
  await create.handle(createBody());
  const before = await store.findVersion(AGENCY, 1);
  const result = await publish.handle(publishBody(1, scale([{ zoneId: AKWA, tiers: [{ upTo: '1 kg', price: 1200 }, ...AKWA_TIERS.slice(1)] }, { zoneId: BONABERI, tiers: BONABERI_TIERS }]), ADMIN));
  assert.equal(result.changed, true);
  assert.equal(result.rateCard.version.number, 2);
  assert.equal(result.rateCard.version.createdBy, ADMIN);
  assert.equal(result.rateCard.version.zones[0]?.tiers[0]?.price, 1200);
  assert.deepEqual(await store.findVersion(AGENCY, 1), before, 'version 1 is unchanged');
  assert.equal((await store.findVersion(AGENCY, null))?.number, 2);
  assert.deepEqual(store.writtenVersions, [2]);
});

test('publishing publishes RateCardVersioned and takes the lock of the rate card', async () => {
  const { create, publish, events, store } = setup();
  const card = await create.handle(createBody());
  events.published.length = 0;
  await publish.handle(publishBody(1, scale([{ zoneId: AKWA, tiers: AKWA_TIERS }])));
  assert.deepEqual(events.published, [{ type: 'RateCardVersioned', agencyId: AGENCY, rateCardId: card.id, actorId: OWNER, version: 2 }]);
  assert.equal(store.locks, 1);
});

test('a version based on an older number is a conflict and nothing is written', async () => {
  const { create, publish, store, events } = setup();
  await create.handle(createBody());
  await publish.handle(publishBody(1, scale([{ zoneId: AKWA, tiers: AKWA_TIERS }])));
  events.published.length = 0;
  await assert.rejects(publish.handle(publishBody(1, scale([{ zoneId: DEIDO, tiers: AKWA_TIERS }]), ADMIN)), StaleRateCardVersion);
  assert.deepEqual(store.versionNumbers(AGENCY), [1, 2]);
  assert.equal(events.published.length, 0);
});

test('an identical scale creates nothing, publishes nothing and answers the version in force', async () => {
  const { create, publish, events, store } = setup();
  await create.handle(createBody());
  events.published.length = 0;
  const result = await publish.handle(publishBody(1));
  assert.deepEqual([result.changed, result.rateCard.version.number], [false, 1]);
  assert.deepEqual([store.saves, events.published.length], [0, 0]);
});

test('publishing needs a rate card: an agency without one answers not found', async () => {
  const { publish } = setup();
  await assert.rejects(publish.handle(publishBody(1)), kindOf('not_found'));
});

test('an agent is forbidden to publish; strangers and former members do not find the agency; nobody takes a lock', async () => {
  const { create, publish, access, store } = setup();
  await create.handle(createBody());
  const locks = [access.sharedLocks, store.locks];
  await assert.rejects(publish.handle(publishBody(1, scale(), AGENT)), kindOf('forbidden'));
  for (const actor of [OUTSIDER, FORMER, OTHER_OWNER]) await assert.rejects(publish.handle(publishBody(1, scale(), actor)), kindOf('not_found'));
  assert.deepEqual([access.sharedLocks, store.locks], locks);
  assert.equal(store.saves, 0);
});

test('a zone retired or foreign in a new version is refused, the version in force stays', async () => {
  const { create, publish, store } = setup();
  await create.handle(createBody());
  await assert.rejects(publish.handle(publishBody(1, scale([{ zoneId: RETIRED_ZONE, tiers: AKWA_TIERS }]))), PricingZoneRetired);
  await assert.rejects(publish.handle(publishBody(1, scale([{ zoneId: FOREIGN_ZONE, tiers: AKWA_TIERS }]))), kindOf('not_found'));
  await assert.rejects(publish.handle(publishBody(1, scale([{ zoneId: AKWA, tiers: [{ upTo: '5', price: 1000 }] }]))), kindOf('invalid'));
  assert.deepEqual(store.versionNumbers(AGENCY), [1]);
});

test('a rate card of another agency is never reached with the identifiers of this one', async () => {
  const { create, publish, access } = setup();
  access.setRole(OTHER_AGENCY, OWNER, null);
  await create.handle(createBody());
  await assert.rejects(publish.handle(publishBody(1, scale(), OWNER, OTHER_AGENCY)), kindOf('not_found'));
});

test('events are audited with the author, the rate card and the version, and no price, weight or zone', async () => {
  const { create, publish, events } = setup();
  const card = await create.handle(createBody());
  await publish.handle(publishBody(1, scale([{ zoneId: AKWA, tiers: AKWA_TIERS }]), ADMIN));
  const audit = new InMemoryAuditLog();
  const subscriber = new PricingAuditSubscriber(audit);
  for (const event of events.published) await subscriber.handle(event);
  await subscriber.handle({ type: 'SomethingElse' });
  assert.deepEqual(audit.entries, [
    { userId: OWNER, action: 'pricing.rate_card_created', agencyId: AGENCY, resourceId: card.id, details: { fields: ['version:1'] } },
    { userId: ADMIN, action: 'pricing.rate_card_versioned', agencyId: AGENCY, resourceId: card.id, details: { fields: ['version:2'] } },
  ]);
});
