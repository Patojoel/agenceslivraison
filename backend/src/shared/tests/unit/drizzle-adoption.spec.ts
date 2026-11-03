import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRITICAL_UNIQUE_INDEXES,
  EXPECTED_DRIZZLE_HISTORY,
  findDrizzleAdoptionProblem,
} from '../../infrastructure/persistence/typeorm/drizzle-adoption';

const genuineHistory = () => EXPECTED_DRIZZLE_HISTORY.map(entry => ({ hash: entry.hash, created_at: String(entry.createdAt) }));

test('the genuine Drizzle history and indexes are adopted', () => {
  assert.equal(EXPECTED_DRIZZLE_HISTORY.length, 7);
  assert.equal(findDrizzleAdoptionProblem(genuineHistory(), CRITICAL_UNIQUE_INDEXES), null);
});

test('numeric created_at values are accepted too', () => {
  const history = EXPECTED_DRIZZLE_HISTORY.map(entry => ({ hash: entry.hash, created_at: entry.createdAt }));
  assert.equal(findDrizzleAdoptionProblem(history, CRITICAL_UNIQUE_INDEXES), null);
});

test('a modified fingerprint is refused', () => {
  const history = genuineHistory();
  history[3] = { hash: 'f'.repeat(64), created_at: history[3]?.created_at ?? '0' };
  assert.match(findDrizzleAdoptionProblem(history, CRITICAL_UNIQUE_INDEXES) ?? '', /history differs/);
});

test('a modified timestamp is refused', () => {
  const history = genuineHistory();
  history[6] = { hash: history[6]?.hash ?? '', created_at: '1' };
  assert.match(findDrizzleAdoptionProblem(history, CRITICAL_UNIQUE_INDEXES) ?? '', /history differs/);
});

test('a partial, extended or reordered history is refused', () => {
  assert.notEqual(findDrizzleAdoptionProblem(genuineHistory().slice(0, 6), CRITICAL_UNIQUE_INDEXES), null);
  assert.notEqual(findDrizzleAdoptionProblem([...genuineHistory(), { hash: 'a'.repeat(64), created_at: '2' }], CRITICAL_UNIQUE_INDEXES), null);
  assert.notEqual(findDrizzleAdoptionProblem(genuineHistory().reverse(), CRITICAL_UNIQUE_INDEXES), null);
});

test('each missing critical unique index is refused and named', () => {
  for (const name of CRITICAL_UNIQUE_INDEXES) {
    const problem = findDrizzleAdoptionProblem(genuineHistory(), CRITICAL_UNIQUE_INDEXES.filter(index => index !== name));
    assert.ok(problem?.includes(name), name);
  }
});
