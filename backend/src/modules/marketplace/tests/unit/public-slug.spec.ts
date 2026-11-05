import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InvalidPublicSlug } from '../../domain/exceptions/marketplace.exceptions';
import { PublicSlug } from '../../domain/value-objects/public-slug';

test('a slug is the name in lower case, without accents, words joined by dashes', () => {
  assert.equal(PublicSlug.fromName('Express Douala', 1).value, 'express-douala');
  assert.equal(PublicSlug.fromName('Éco & Rapide', 1).value, 'eco-rapide');
  assert.equal(PublicSlug.fromName('  Livraison   Bonabéri 24/7 ', 1).value, 'livraison-bonaberi-24-7');
});

test('a collision is solved by a numeric suffix from the second attempt', () => {
  assert.equal(PublicSlug.fromName('Express Douala', 2).value, 'express-douala-2');
  assert.equal(PublicSlug.fromName('Express Douala', 3).value, 'express-douala-3');
});

test('a name too short to make three characters has no slug', () => {
  assert.equal(PublicSlug.derivable('A'), false);
  assert.equal(PublicSlug.derivable('É!'), false);
  assert.equal(PublicSlug.derivable('!!!'), false);
  assert.equal(PublicSlug.derivable('Abc'), true);
  assert.throws(() => PublicSlug.fromName('A', 1), InvalidPublicSlug);
});

test('a long name is cut at 80 characters, suffix included, without a trailing dash', () => {
  assert.equal(PublicSlug.fromName(`${'a'.repeat(79)} bbbbbb`, 1).value, 'a'.repeat(79));
  assert.equal(PublicSlug.fromName('x'.repeat(200), 1).value.length, 80);
  const suffixed = PublicSlug.fromName('x'.repeat(200), 12).value;
  assert.equal(suffixed.length, 80);
  assert.ok(suffixed.endsWith('-12'));
  assert.equal(PublicSlug.fromName(`${'a'.repeat(76)} ${'b'.repeat(10)}`, 12).value, `${'a'.repeat(76)}-12`);
});

test('a stored slug is only accepted in the shape the domain produces', () => {
  assert.equal(PublicSlug.reconstitute('express-douala-2').value, 'express-douala-2');
  for (const bad of ['', 'ab', 'Express', 'a b c', '-abc', 'abc-', 'a--b', 'é-é-é', 'a'.repeat(81)]) assert.throws(() => PublicSlug.reconstitute(bad), InvalidPublicSlug, bad);
});
