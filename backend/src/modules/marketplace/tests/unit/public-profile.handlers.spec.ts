import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedClock, RecordingEventPublisher, T0 } from '@shared/tests/doubles/fakes';
import { PublishPublicProfileHandler } from '../../application/commands/publish-public-profile/publish-public-profile.handler';
import { UnpublishPublicProfileHandler } from '../../application/commands/unpublish-public-profile/unpublish-public-profile.handler';
import { GetPublicProfileHandler } from '../../application/queries/get-public-profile/get-public-profile.handler';
import {
  AgencyNotSubmitted, MarketplaceAgencyNotFound, MarketplaceForbidden, NoActiveCapability, ProfileAlreadyPublished, ProfileNotPublished, PublicSlugUnavailable, TradeNameNotPublishable,
} from '../../domain/exceptions/marketplace.exceptions';
import { ADMIN, AGENCY, AGENT, FORMER, FakeAgencyAccess, InMemoryProfiles, OTHER_AGENCY, OTHER_OWNER, OUTSIDER, OWNER, view } from '../doubles/fakes';

function setup() {
  const access = new FakeAgencyAccess();
  const profiles = new InMemoryProfiles();
  const clock = new FixedClock();
  const events = new RecordingEventPublisher();
  return {
    access, profiles, clock, events,
    publish: new PublishPublicProfileHandler(access, profiles, clock, events),
    unpublish: new UnpublishPublicProfileHandler(access, profiles, clock, events),
    read: new GetPublicProfileHandler(access, profiles),
  };
}

const publishAs = (kit: ReturnType<typeof setup>, actorId: string, agencyId = AGENCY) => kit.publish.handle({ actorId, agencyId });
const unpublishAs = (kit: ReturnType<typeof setup>, actorId: string, agencyId = AGENCY) => kit.unpublish.handle({ actorId, agencyId });

test('the owner publishes a submitted agency: slug, date, mention "not verified", one event', async () => {
  const kit = setup();
  const state = await publishAs(kit, OWNER);
  assert.deepEqual(state, { published: true, slug: 'express-douala', publishedAt: T0.toISOString(), unpublishedAt: null, visible: true, verification: 'unverified', obstacles: [] });
  assert.deepEqual(kit.events.types(), ['AgencyPublicProfilePublished']);
  assert.equal(kit.profiles.adds, 1);
});

test('an administrator and an agent are refused, without taking any lock; strangers find nothing', async () => {
  const kit = setup();
  for (const actor of [ADMIN, AGENT]) await assert.rejects(publishAs(kit, actor), MarketplaceForbidden);
  for (const actor of [FORMER, OUTSIDER, OTHER_OWNER]) await assert.rejects(publishAs(kit, actor), MarketplaceAgencyNotFound);
  await assert.rejects(publishAs(kit, OWNER, '00000000-0000-4000-8000-0000000000ff'), MarketplaceAgencyNotFound);
  assert.deepEqual([kit.access.publicationLocks, kit.profiles.locks, kit.profiles.adds, kit.events.published.length], [0, 0, 0, 0]);
});

test('a former member is refused even when the role changes while the caller waits for the lock', async () => {
  const kit = setup();
  kit.access.onLock = () => kit.access.setRole(AGENCY, OWNER, 'admin');
  await assert.rejects(publishAs(kit, OWNER), MarketplaceForbidden);
  assert.equal(kit.profiles.adds, 0);
  kit.access.setRole(AGENCY, OWNER, 'owner');
  kit.access.onLock = () => kit.access.setRole(AGENCY, OWNER, null);
  await assert.rejects(publishAs(kit, OWNER), MarketplaceAgencyNotFound);
});

test('a second publication is a conflict with no second effect', async () => {
  const kit = setup();
  await publishAs(kit, OWNER);
  await assert.rejects(publishAs(kit, OWNER), ProfileAlreadyPublished);
  assert.deepEqual([kit.events.published.length, kit.profiles.adds, kit.profiles.saves], [1, 1, 0]);
});

test('a draft, an agency without capability and an unpublishable name are conflicts that write nothing', async () => {
  const kit = setup();
  kit.access.setView(AGENCY, view({ submitted: false }));
  await assert.rejects(publishAs(kit, OWNER), AgencyNotSubmitted);
  kit.access.setView(AGENCY, view({ capabilities: [] }));
  await assert.rejects(publishAs(kit, OWNER), NoActiveCapability);
  kit.access.setView(AGENCY, view({ tradeName: 'Express‮Douala' }));
  await assert.rejects(publishAs(kit, OWNER), TradeNameNotPublishable);
  assert.deepEqual([kit.profiles.adds, kit.events.published.length], [0, 0]);
});

test('an address taken by another agency gives the next suffix', async () => {
  const kit = setup();
  kit.profiles.foreignSlugs.add('express-douala');
  assert.equal((await publishAs(kit, OWNER)).slug, 'express-douala-2');
  const second = setup();
  second.profiles.foreignSlugs.add('express-douala').add('express-douala-2');
  assert.equal((await publishAs(second, OWNER)).slug, 'express-douala-3');
});

test('when every address is taken, the publication is refused with a conflict', async () => {
  const kit = setup();
  for (let attempt = 1; attempt <= 50; attempt += 1) kit.profiles.foreignSlugs.add(attempt === 1 ? 'express-douala' : `express-douala-${attempt}`);
  await assert.rejects(publishAs(kit, OWNER), PublicSlugUnavailable);
  assert.equal(kit.events.published.length, 0);
});

test('an address is never given to another agency, even after the withdrawal', async () => {
  const kit = setup();
  await publishAs(kit, OWNER);
  await unpublishAs(kit, OWNER);
  kit.access.setView(OTHER_AGENCY, view({ tradeName: 'Express Douala' }));
  assert.equal((await publishAs(kit, OTHER_OWNER, OTHER_AGENCY)).slug, 'express-douala-2');
});

test('the address survives a new name and a withdrawal followed by a new publication', async () => {
  const kit = setup();
  await publishAs(kit, OWNER);
  await unpublishAs(kit, OWNER);
  kit.access.setView(AGENCY, view({ tradeName: 'Express Douala & Littoral' }));
  kit.clock.advance(1000);
  const again = await publishAs(kit, OWNER);
  assert.equal(again.slug, 'express-douala');
  assert.equal(again.publishedAt, new Date(T0.getTime() + 1000).toISOString());
  assert.deepEqual(kit.events.types(), ['AgencyPublicProfilePublished', 'AgencyPublicProfileUnpublished', 'AgencyPublicProfilePublished']);
});

test('two first publications at once end in one publication and one conflict', async () => {
  const kit = setup();
  // The other request commits between our check and our insert: the database then answers "already has a profile".
  kit.profiles.onAdd = () => { kit.profiles.onAdd = null; kit.profiles.seed(AGENCY, 'express-douala', true, T0); };
  await assert.rejects(publishAs(kit, OWNER), ProfileAlreadyPublished);
  assert.equal(kit.events.published.length, 0);
});

test('withdrawing: the owner alone, a published profile only, with one event and no second effect', async () => {
  const kit = setup();
  await publishAs(kit, OWNER);
  for (const actor of [ADMIN, AGENT]) await assert.rejects(unpublishAs(kit, actor), MarketplaceForbidden);
  for (const actor of [FORMER, OUTSIDER, OTHER_OWNER]) await assert.rejects(unpublishAs(kit, actor), MarketplaceAgencyNotFound);
  const state = await unpublishAs(kit, OWNER);
  assert.deepEqual([state.published, state.slug, state.visible, state.unpublishedAt], [false, 'express-douala', false, T0.toISOString()]);
  await assert.rejects(unpublishAs(kit, OWNER), ProfileNotPublished);
  assert.deepEqual(kit.events.types(), ['AgencyPublicProfilePublished', 'AgencyPublicProfileUnpublished']);
});

test('withdrawing a profile that was never published is a conflict', async () => {
  const kit = setup();
  await assert.rejects(unpublishAs(kit, OWNER), ProfileNotPublished);
  assert.equal(kit.events.published.length, 0);
});

test('every active member reads the state of the profile; a stranger finds nothing', async () => {
  const kit = setup();
  for (const actor of [OWNER, ADMIN, AGENT]) {
    assert.deepEqual(await kit.read.handle({ agencyId: AGENCY, userId: actor }), { published: false, slug: null, publishedAt: null, unpublishedAt: null, visible: false, verification: 'unverified', obstacles: [] });
  }
  for (const actor of [FORMER, OUTSIDER, OTHER_OWNER]) await assert.rejects(kit.read.handle({ agencyId: AGENCY, userId: actor }), MarketplaceAgencyNotFound);
});

test('the state tells what hides a published profile and what prevents a new one', async () => {
  const kit = setup();
  await publishAs(kit, OWNER);
  kit.access.setView(AGENCY, view({ capabilities: [] }));
  const hidden = await kit.read.handle({ agencyId: AGENCY, userId: AGENT });
  assert.deepEqual([hidden.published, hidden.visible, hidden.obstacles, hidden.slug], [true, false, ['no_active_capability'], 'express-douala']);
  kit.access.setView(AGENCY, view({ submitted: false, tradeName: `Agence ${AGENCY.slice(0, 8)}` }));
  assert.deepEqual((await kit.read.handle({ agencyId: AGENCY, userId: OWNER })).obstacles, ['agency_not_submitted', 'provisional_trade_name']);
});

test('publishing and unpublishing take the publication lock of the agency, once, before the profile (B3.17)', async () => {
  const kit = setup();
  const order: string[] = [];
  kit.access.onLock = () => order.push(`agency:${kit.profiles.locks}`);
  await publishAs(kit, OWNER);
  await unpublishAs(kit, OWNER);
  assert.equal(kit.access.publicationLocks, 2);
  assert.deepEqual(order, ['agency:0', 'agency:1']);
});
