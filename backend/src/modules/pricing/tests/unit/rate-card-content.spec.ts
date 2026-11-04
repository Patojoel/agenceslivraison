import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uuid } from '@shared/tests/doubles/fakes';
import { RateCardContent } from '../../domain/rate-card-content';

const Z1 = uuid(501);
const Z2 = uuid(502);
const invalid = (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'invalid';
const tier = (upTo: string, price: number) => ({ upTo, price });
const akwa = [tier('1 kg', 1000), tier('5 kg', 1500), tier('10 kg', 2500), tier('30 kg', 5000)];

test('a scale keeps its zones in a canonical order and its tiers in grams', () => {
  const content = RateCardContent.of(null, [{ zoneId: Z2, tiers: [tier('1 kg', 1500)] }, { zoneId: Z1, tiers: akwa }]);
  assert.deepEqual(content.lines.map(line => line.zoneId.value), [Z1, Z2]);
  assert.deepEqual(content.lines[0]?.tiers.map(item => [item.upTo.grams, item.price.value]), [[1000, 1000], [5000, 1500], [10_000, 2500], [30_000, 5000]]);
  assert.equal(content.divisor, null);
});

test('units are equivalent: 1 kg, 1000 g and 1,0 kg give the same scale', () => {
  const prints = ['1 kg', '1000 g', '1,0 kg'].map(upTo => RateCardContent.of(null, [{ zoneId: Z1, tiers: [tier(upTo, 1000)] }]).fingerprint());
  assert.equal(new Set(prints).size, 1);
});

test('the divisor is optional and bounded', () => {
  assert.equal(RateCardContent.of(5000, [{ zoneId: Z1, tiers: akwa }]).divisor?.value, 5000);
  assert.equal(RateCardContent.of(undefined, [{ zoneId: Z1, tiers: akwa }]).divisor, null);
  assert.throws(() => RateCardContent.of(999, [{ zoneId: Z1, tiers: akwa }]), invalid);
});

test('tiers must strictly increase', () => {
  for (const tiers of [[tier('5 kg', 1500), tier('1 kg', 1000)], [tier('1 kg', 1000), tier('1000 g', 1500)], [tier('1 kg', 1000), tier('1 kg', 1000)]]) {
    assert.throws(() => RateCardContent.of(null, [{ zoneId: Z1, tiers }]), invalid);
  }
});

test('a tier holds a valid bound and price', () => {
  for (const bad of [tier('5', 1000), tier('1 kg', 0), tier('1 kg', 1000.5), tier('1001 kg', 1000), tier('1 kg', 10_000_001)]) {
    assert.throws(() => RateCardContent.of(null, [{ zoneId: Z1, tiers: [bad] }]), invalid);
  }
});

test('a zone appears once, with 1 to 20 tiers, and a scale has 1 to 100 zones', () => {
  assert.throws(() => RateCardContent.of(null, [{ zoneId: Z1, tiers: akwa }, { zoneId: Z1, tiers: akwa }]), invalid);
  assert.throws(() => RateCardContent.of(null, [{ zoneId: Z1, tiers: [] }]), invalid);
  assert.throws(() => RateCardContent.of(null, []), invalid);
  const tiers = (count: number) => Array.from({ length: count }, (_, index) => tier(`${index + 1} kg`, 1000 + index));
  assert.equal(RateCardContent.of(null, [{ zoneId: Z1, tiers: tiers(20) }]).lines.length, 1);
  assert.throws(() => RateCardContent.of(null, [{ zoneId: Z1, tiers: tiers(21) }]), invalid);
  const zones = (count: number) => Array.from({ length: count }, (_, index) => ({ zoneId: uuid(1000 + index), tiers: [tier('1 kg', 1000)] }));
  assert.equal(RateCardContent.of(null, zones(100)).lines.length, 100);
  assert.throws(() => RateCardContent.of(null, zones(101)), invalid);
});

test('a zone identifier must be a UUID', () => {
  assert.throws(() => RateCardContent.of(null, [{ zoneId: 'akwa', tiers: akwa }]), invalid);
});

test('the same scale has the same fingerprint whatever the order of the zones; another price changes it', () => {
  const one = RateCardContent.of(null, [{ zoneId: Z1, tiers: akwa }, { zoneId: Z2, tiers: [tier('1 kg', 1500)] }]);
  const other = RateCardContent.of(null, [{ zoneId: Z2, tiers: [tier('1 kg', 1500)] }, { zoneId: Z1, tiers: akwa }]);
  const changed = RateCardContent.of(null, [{ zoneId: Z2, tiers: [tier('1 kg', 1501)] }, { zoneId: Z1, tiers: akwa }]);
  assert.equal(one.fingerprint(), other.fingerprint());
  assert.notEqual(one.fingerprint(), changed.fingerprint());
  assert.notEqual(one.fingerprint(), RateCardContent.of(5000, [{ zoneId: Z1, tiers: akwa }, { zoneId: Z2, tiers: [tier('1 kg', 1500)] }]).fingerprint());
});
