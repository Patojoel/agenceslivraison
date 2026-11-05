import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T0 } from '@shared/tests/doubles/fakes';
import { PublicDirectoryRecord } from '../../application/ports/read-public-directory.repository';
import { toDetail, toSummary } from '../../application/read-models/public-agency.read-model';

const record = (overrides: Partial<PublicDirectoryRecord> = {}): PublicDirectoryRecord => ({
  slug: 'express-douala', name: 'Express Douala', nameKey: 'express douala', description: 'Livraison', verification: 'unverified',
  capabilities: ['delivery'], zones: [{ city: 'Douala', district: 'Akwa', startingPrice: 1000 }], siteCities: ['Douala'], publishedAt: T0, ...overrides,
});

test('a summary holds exactly the closed list of fields of the directory', () => {
  assert.deepEqual(Object.keys(toSummary(record())).sort(), ['capabilities', 'cities', 'hybrid', 'slug', 'tradeName', 'verification']);
});

test('a fiche holds exactly the closed list of fields, and no sort key', () => {
  const detail = toDetail(record());
  assert.deepEqual(Object.keys(detail).sort(), ['capabilities', 'description', 'hybrid', 'pricing', 'publishedAt', 'siteCities', 'slug', 'tradeName', 'verification', 'zones']);
  assert.deepEqual(Object.keys(detail.zones[0] ?? {}).sort(), ['city', 'district', 'startingPrice']);
  assert.equal(JSON.stringify(detail).includes('nameKey'), false);
});

test('the cities are those of the zones and of the sites, once each whatever the case or the accents, in alphabetical order', () => {
  const cities = toSummary(record({
    zones: [{ city: 'Yaoundé', district: null, startingPrice: null }, { city: 'Douala', district: 'Akwa', startingPrice: null }, { city: 'douala', district: 'Deido', startingPrice: null }],
    siteCities: ['Édéa', 'YAOUNDE'],
  })).cities;
  assert.deepEqual(cities, ['Douala', 'Édéa', 'Yaoundé']);
});

test('an agency is hybrid when both capabilities are active', () => {
  assert.equal(toSummary(record({ capabilities: ['delivery', 'storage'] })).hybrid, true);
  assert.equal(toDetail(record({ capabilities: ['storage'] })).hybrid, false);
});

test('prices are indicative while a zone shows one, and on quote when none does', () => {
  assert.deepEqual(toDetail(record()).pricing, { currency: 'XAF', notice: 'indicative_not_guaranteed' });
  assert.deepEqual(toDetail(record({ zones: [{ city: 'Douala', district: null, startingPrice: null }] })).pricing, { currency: 'XAF', notice: 'on_quote' });
  assert.deepEqual(toDetail(record({ zones: [] })).pricing, { currency: 'XAF', notice: 'on_quote' });
});

test('the publication date is an ISO string and the description is not touched', () => {
  const detail = toDetail(record({ description: '<script>alert(1)</script>' }));
  assert.equal(detail.publishedAt, T0.toISOString());
  assert.equal(detail.description, '<script>alert(1)</script>');
});
