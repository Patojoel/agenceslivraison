import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDraft, AgencyInputError } from '../../src/modules/agencies/domain/draft';

test('a new agency begins as an unapproved draft', () => {
  assert.deepEqual(createDraft('  Agence de Douala  '), { name: 'Agence de Douala', status: 'draft' });
});
test('a draft requires a bounded, nonblank name', () => {
  for (const name of ['', '   ', 'x'.repeat(161)]) assert.throws(() => createDraft(name), AgencyInputError);
});
