import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainEvent } from '@shared/domain/domain-event';
import { FixedClock, T0 } from '@shared/tests/doubles/fakes';
import { PublicListingProjectionSubscriber } from '../../application/subscribers/public-listing-projection.subscriber';
import { AGENCY, AKWA, BONABERI, FakeAgencyAccess, FakePrices, InMemoryListings, InMemoryProfiles, OTHER_AGENCY, OWNER, view } from '../doubles/fakes';

function setup(published = true) {
  const access = new FakeAgencyAccess();
  const profiles = new InMemoryProfiles();
  const prices = new FakePrices();
  const listings = new InMemoryListings();
  if (published) profiles.seed(AGENCY, 'express-douala', true, T0);
  const subscriber = new PublicListingProjectionSubscriber(access, profiles, prices, listings, new FixedClock());
  return { access, profiles, prices, listings, subscriber };
}

const event = (type: string, agencyId = AGENCY): DomainEvent => ({ type, agencyId, actorId: OWNER } as DomainEvent);

const RELEVANT = [
  'AgencyIdentityUpdated', 'AgencyProfileUpdated', 'AgencySubmittedForVerification',
  'ServiceZoneAdded', 'ServiceZoneRenamed', 'ServiceZoneRetired',
  'AgencySiteCreated', 'AgencySiteUpdated', 'AgencySiteDeactivated', 'AgencySiteReactivated',
  'AgencyCapabilityEnabled', 'AgencyCapabilitySuspended',
  'RateCardCreated', 'RateCardVersioned',
  'AgencyPublicProfilePublished', 'AgencyPublicProfileUnpublished',
];

test('every event that can change what the directory says rebuilds the listing of the agency', async () => {
  for (const type of RELEVANT) {
    const kit = setup();
    await kit.subscriber.handle(event(type));
    assert.equal(kit.listings.upserts, 1, type);
    assert.equal(kit.listings.of(AGENCY)?.slug, 'express-douala', type);
  }
});

test('events that say nothing about the public side are ignored without any read', async () => {
  const kit = setup();
  for (const type of ['AgencyRegistered', 'InvitationIssued', 'InvitationAccepted', 'MembershipRoleChanged', 'MembershipRevoked', 'QuoteIssued', 'QuoteAccepted', 'SessionOpened', 'UserRegistered']) await kit.subscriber.handle(event(type));
  assert.deepEqual([kit.listings.upserts, kit.profiles.locks], [0, 0]);
});

test('an agency that never published has no listing, and nothing is read for it', async () => {
  const kit = setup(false);
  await kit.subscriber.handle(event('AgencyProfileUpdated'));
  await kit.subscriber.handle(event('ServiceZoneAdded', OTHER_AGENCY));
  assert.equal(kit.listings.upserts, 0);
});

test('the rebuild takes the lock of the profile before it reads, so that concurrent rebuilds of one agency queue up', async () => {
  const kit = setup();
  const order: string[] = [];
  const lock = kit.profiles.lockByAgency.bind(kit.profiles);
  kit.profiles.lockByAgency = async agencyId => { order.push('lock'); return lock(agencyId); };
  const viewOf = kit.access.publicViewOf.bind(kit.access);
  kit.access.publicViewOf = async agencyId => { order.push('view'); return viewOf(agencyId); };
  const pricesOf = kit.prices.startingPricesByZone.bind(kit.prices);
  kit.prices.startingPricesByZone = async agencyId => { order.push('prices'); return pricesOf(agencyId); };
  await kit.subscriber.handle(event('RateCardVersioned'));
  assert.deepEqual(order, ['lock', 'view', 'prices']);
});

test('a retired zone disappears from the listing', async () => {
  const kit = setup();
  await kit.subscriber.handle(event('AgencyProfileUpdated'));
  assert.equal(kit.listings.of(AGENCY)?.zones.length, 2);
  kit.access.setView(AGENCY, view({ zones: [{ id: AKWA, city: 'Douala', district: 'Akwa' }] }));
  await kit.subscriber.handle(event('ServiceZoneRetired'));
  assert.deepEqual(kit.listings.of(AGENCY)?.zones.map(zone => zone.id), [AKWA]);
});

test('the last active capability suspended hides the listing without unpublishing it, and its return shows it again', async () => {
  const kit = setup();
  await kit.subscriber.handle(event('AgencyCapabilityEnabled'));
  assert.equal(kit.listings.of(AGENCY)?.visible, true);
  kit.access.setView(AGENCY, view({ capabilities: [] }));
  await kit.subscriber.handle(event('AgencyCapabilitySuspended'));
  assert.equal(kit.listings.of(AGENCY)?.visible, false);
  assert.equal((await kit.profiles.findRecord(AGENCY))?.published, true);
  kit.access.setView(AGENCY, view());
  await kit.subscriber.handle(event('AgencyCapabilityEnabled'));
  assert.equal(kit.listings.of(AGENCY)?.visible, true);
});

test('a new version of the rate card changes the starting prices', async () => {
  const kit = setup();
  kit.prices.set(AGENCY, { [AKWA]: 1000 });
  await kit.subscriber.handle(event('RateCardCreated'));
  assert.deepEqual(kit.listings.of(AGENCY)?.zones.map(zone => [zone.id, zone.startingPrice]), [[AKWA, 1000], [BONABERI, null]]);
  kit.prices.set(AGENCY, { [AKWA]: 900, [BONABERI]: 1500 });
  await kit.subscriber.handle(event('RateCardVersioned'));
  assert.deepEqual(kit.listings.of(AGENCY)?.zones.map(zone => [zone.id, zone.startingPrice]), [[AKWA, 900], [BONABERI, 1500]]);
});

test('a new name replaces the old one in the listing, and the address does not move', async () => {
  const kit = setup();
  kit.access.setView(AGENCY, view({ tradeName: 'Express Douala & Littoral' }));
  await kit.subscriber.handle(event('AgencyProfileUpdated'));
  assert.deepEqual([kit.listings.of(AGENCY)?.name, kit.listings.of(AGENCY)?.slug], ['Express Douala & Littoral', 'express-douala']);
});

test('withdrawing the profile hides the listing', async () => {
  const kit = setup();
  await kit.subscriber.handle(event('AgencyPublicProfilePublished'));
  assert.equal(kit.listings.of(AGENCY)?.visible, true);
  kit.profiles.seed(AGENCY, 'express-douala', false, T0);
  await kit.subscriber.handle(event('AgencyPublicProfileUnpublished'));
  assert.equal(kit.listings.of(AGENCY)?.visible, false);
});

test('rebuilding twice gives the same listing', async () => {
  const kit = setup();
  await kit.subscriber.handle(event('ServiceZoneAdded'));
  const first = JSON.stringify(kit.listings.of(AGENCY));
  await kit.subscriber.handle(event('ServiceZoneAdded'));
  assert.equal(JSON.stringify(kit.listings.of(AGENCY)), first);
  assert.equal(kit.listings.rows.size, 1);
});

test('a failing read or write makes the subscriber fail, which cancels the action that raised the event', async () => {
  const unreadable = setup();
  unreadable.prices.failWith = new Error('prices unavailable');
  await assert.rejects(unreadable.subscriber.handle(event('RateCardVersioned')), /prices unavailable/);
  const unwritable = setup();
  unwritable.listings.failWith = new Error('write failed');
  await assert.rejects(unwritable.subscriber.handle(event('AgencyProfileUpdated')), /write failed/);
});
