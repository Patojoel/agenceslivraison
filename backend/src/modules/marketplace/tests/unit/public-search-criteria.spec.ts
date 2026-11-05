import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PublicSearchCriteria } from '../../domain/value-objects/public-search-criteria';

const refused = (input: Parameters<typeof PublicSearchCriteria.of>[0]): void =>
  assert.throws(() => PublicSearchCriteria.of(input), { message: 'Invalid search parameters' });

test('a search without parameters asks for the first 20 agencies, whatever their name, city or capability', () => {
  const criteria = PublicSearchCriteria.of({});
  assert.deepEqual([criteria.nameContains, criteria.cityKey, criteria.districtKey, [...criteria.capabilities], criteria.limit, criteria.districtAreaKeys], [null, null, null, [], 20, null]);
});

test('the text is compared without case, accents or repeated spaces', () => {
  assert.equal(PublicSearchCriteria.of({ q: '  ÉXPRESS   Douala ' }).nameContains, 'express douala');
  assert.equal(PublicSearchCriteria.of({ city: 'YAOUNDÉ' }).cityKey, 'yaounde');
});

test('the text is 2 to 80 characters once cleaned up', () => {
  assert.equal(PublicSearchCriteria.of({ q: 'ab' }).nameContains, 'ab');
  assert.equal(PublicSearchCriteria.of({ q: 'a'.repeat(80) }).nameContains?.length, 80);
  refused({ q: 'a' });
  refused({ q: '' });
  refused({ q: '   a   ' });
  refused({ q: 'a'.repeat(81) });
  refused({ city: 'x' });
  refused({ district: 'x', city: 'Douala' });
});

test('a control or format character in any text is refused, NUL and the right-to-left override included', () => {
  for (const bad of ['ab\u0000cd', 'ab‮cd', 'ab​cd', 'ab\u0007cd', 'ab﻿cd']) {
    refused({ q: bad });
    refused({ city: bad });
    refused({ city: 'Douala', district: bad });
  }
});

test('a district needs a city, and matches the district itself or the whole city', () => {
  refused({ district: 'Akwa' });
  const criteria = PublicSearchCriteria.of({ city: 'Douala', district: 'Bonabéri' });
  assert.deepEqual(criteria.districtAreaKeys, ['douala\u001f', 'douala\u001fbonaberi']);
});

test('the limit is a whole number from 1 to 50', () => {
  assert.equal(PublicSearchCriteria.of({ limit: 1 }).limit, 1);
  assert.equal(PublicSearchCriteria.of({ limit: 50 }).limit, 50);
  for (const limit of [0, 51, -1, 1.5, Number.NaN]) refused({ limit });
});

test('the capabilities are delivery, storage, or both, in a fixed order and without repetition; anything else is refused', () => {
  assert.deepEqual([...PublicSearchCriteria.of({ capabilities: ['storage', 'delivery', 'storage'] }).capabilities], ['delivery', 'storage']);
  assert.deepEqual([...PublicSearchCriteria.of({ capabilities: ['storage'] }).capabilities], ['storage']);
  for (const bad of ['transport', 'hybrid', 'Delivery', '', 'delivery,storage']) refused({ capabilities: [bad] });
});

test('equivalent searches share one canonical form, different searches do not, and the page size is not part of it', () => {
  const base = PublicSearchCriteria.of({ q: 'Express', city: 'Douala', capabilities: ['delivery', 'storage'] });
  assert.equal(PublicSearchCriteria.of({ q: ' éxpress ', city: 'DOUALA', capabilities: ['storage', 'delivery'], limit: 5 }).canonical, base.canonical);
  for (const other of [{ q: 'Express', city: 'Yaoundé', capabilities: ['delivery', 'storage'] }, { q: 'Express', city: 'Douala', capabilities: ['delivery'] }, { city: 'Douala', capabilities: ['delivery', 'storage'] }, { q: 'Express', city: 'Douala', district: 'Akwa', capabilities: ['delivery', 'storage'] }]) {
    assert.notEqual(PublicSearchCriteria.of(other).canonical, base.canonical);
  }
});
