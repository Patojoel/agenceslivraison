import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T0, uuid } from '@shared/tests/doubles/fakes';
import { UserId } from '@shared/domain/value-objects/user-id';
import { RateCard } from '../../domain/rate-card';
import { RateCardContent } from '../../domain/rate-card-content';
import { ZoneDirectory } from '../../domain/zone-directory';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { RateCardId } from '../../domain/value-objects/rate-card-id';

const AKWA = uuid(501);
const BONABERI = uuid(502);
const RETIRED = uuid(503);
const AUTHOR = UserId.of(uuid(2));
const AGENCY = AgencyId.of(uuid(10));
const CARD = RateCardId.of(uuid(700));
const kindOf = (kind: string, code?: string) => (error: unknown) =>
  error instanceof Error && 'kind' in error && error.kind === kind && (code === undefined || ('extras' in error && typeof error.extras === 'object' && error.extras !== null && 'code' in error.extras && error.extras.code === code));

const zones: ZoneDirectory = { statusOf: id => (id === AKWA || id === BONABERI ? 'active' : id === RETIRED ? 'retired' : 'unknown') };
const content = (price = 1000, zone = AKWA) => RateCardContent.of(null, [{ zoneId: zone, tiers: [{ upTo: '1 kg', price }, { upTo: '5 kg', price: price + 500 }] }]);
const created = () => RateCard.create({ id: CARD, agencyId: AGENCY, content: content(), zones, authorId: AUTHOR, now: T0 });

test('creating a rate card yields version 1, in force, and the event', () => {
  const card = created();
  assert.equal(card.snapshot().current.number, 1);
  assert.deepEqual(card.pullEvents(), [{ type: 'RateCardCreated', agencyId: AGENCY.value, rateCardId: CARD.value, actorId: AUTHOR.value, version: 1 }]);
  assert.equal(card.snapshot().current.createdAt, T0);
});

test('only the active zones of the agency can be priced: unknown is not found, retired is a conflict', () => {
  assert.throws(() => RateCard.create({ id: CARD, agencyId: AGENCY, content: content(1000, uuid(999)), zones, authorId: AUTHOR, now: T0 }), kindOf('not_found'));
  assert.throws(() => RateCard.create({ id: CARD, agencyId: AGENCY, content: content(1000, RETIRED), zones, authorId: AUTHOR, now: T0 }), kindOf('conflict', 'ZONE_RETIRED'));
  const mixed = RateCardContent.of(null, [{ zoneId: RETIRED, tiers: [{ upTo: '1 kg', price: 1 }] }, { zoneId: uuid(999), tiers: [{ upTo: '1 kg', price: 1 }] }]);
  assert.throws(() => RateCard.create({ id: CARD, agencyId: AGENCY, content: mixed, zones, authorId: AUTHOR, now: T0 }), kindOf('not_found'));
});

test('publishing on the version in force creates the next one and leaves the previous one untouched', () => {
  const card = created();
  card.pullEvents();
  const before = card.snapshot().current;
  const changed = card.publish({ basedOn: 1, content: content(1200), zones, authorId: AUTHOR, now: new Date(T0.getTime() + 1000) });
  assert.equal(changed, true);
  assert.equal(card.snapshot().current.number, 2);
  assert.equal(before.number, 1);
  assert.equal(before.content.lines[0]?.tiers[0]?.price.value, 1000, 'version 1 is unchanged');
  assert.equal(card.snapshot().current.content.lines[0]?.tiers[0]?.price.value, 1200);
  assert.deepEqual(card.pullEvents(), [{ type: 'RateCardVersioned', agencyId: AGENCY.value, rateCardId: CARD.value, actorId: AUTHOR.value, version: 2 }]);
});

test('a version based on an old number is a conflict and nothing changes', () => {
  const card = created();
  card.publish({ basedOn: 1, content: content(1200), zones, authorId: AUTHOR, now: T0 });
  card.pullEvents();
  assert.throws(() => card.publish({ basedOn: 1, content: content(1300), zones, authorId: AUTHOR, now: T0 }), kindOf('conflict', 'STALE_RATE_CARD_VERSION'));
  assert.equal(card.snapshot().current.number, 2);
  assert.deepEqual(card.pullEvents(), []);
});

test('an identical scale creates nothing and records nothing', () => {
  const card = created();
  card.pullEvents();
  assert.equal(card.publish({ basedOn: 1, content: content(), zones, authorId: AUTHOR, now: T0 }), false);
  assert.equal(card.snapshot().current.number, 1);
  assert.deepEqual(card.pullEvents(), []);
});

test('a new version is checked against the zones too, and a refusal keeps the version in force', () => {
  const card = created();
  card.pullEvents();
  assert.throws(() => card.publish({ basedOn: 1, content: content(1000, RETIRED), zones, authorId: AUTHOR, now: T0 }), kindOf('conflict', 'ZONE_RETIRED'));
  assert.throws(() => card.publish({ basedOn: 1, content: content(1000, uuid(999)), zones, authorId: AUTHOR, now: T0 }), kindOf('not_found'));
  assert.equal(card.snapshot().current.number, 1);
  assert.deepEqual(card.pullEvents(), []);
});

test('a retired zone keeps its tiers in the version in force, and it is priced again when the zone comes back', () => {
  const card = created();
  assert.equal(card.quote(AKWA, [{ weight: '1 kg', dimensions: null }]).status, 'priced');
  const reactivated = RateCard.reconstitute(card.snapshot());
  assert.equal(reactivated.quote(AKWA, [{ weight: '0,5 kg', dimensions: null }]).status, 'priced');
});
