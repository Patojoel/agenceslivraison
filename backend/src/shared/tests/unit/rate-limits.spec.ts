import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '@config/env.schema';

const BASE = { DATABASE_URL: 'postgres://user:secret@localhost:5432/db' };

test('without configuration the limits are those of production: 120 a minute, 60 for the public directory', () => {
  const env = validateEnv(BASE);
  assert.deepEqual([env.RATE_LIMIT_DEFAULT_PER_MINUTE, env.RATE_LIMIT_PUBLIC_PER_MINUTE], [120, 60]);
});

test('outside production the limits may be raised, for a test run that makes thousands of calls', () => {
  const env = validateEnv({ ...BASE, NODE_ENV: 'test', RATE_LIMIT_DEFAULT_PER_MINUTE: '100000', RATE_LIMIT_PUBLIC_PER_MINUTE: '100000' });
  assert.deepEqual([env.RATE_LIMIT_DEFAULT_PER_MINUTE, env.RATE_LIMIT_PUBLIC_PER_MINUTE], [100000, 100000]);
  assert.equal(validateEnv({ ...BASE, RATE_LIMIT_PUBLIC_PER_MINUTE: '500' }).RATE_LIMIT_PUBLIC_PER_MINUTE, 500, 'the default environment is development');
});

test('in production the limits may be lowered but never raised: the protection cannot be switched off', () => {
  const lowered = validateEnv({ ...BASE, NODE_ENV: 'production', RATE_LIMIT_DEFAULT_PER_MINUTE: '30', RATE_LIMIT_PUBLIC_PER_MINUTE: '10' });
  assert.deepEqual([lowered.RATE_LIMIT_DEFAULT_PER_MINUTE, lowered.RATE_LIMIT_PUBLIC_PER_MINUTE], [30, 10]);
  const exact = validateEnv({ ...BASE, NODE_ENV: 'production', RATE_LIMIT_DEFAULT_PER_MINUTE: '120', RATE_LIMIT_PUBLIC_PER_MINUTE: '60' });
  assert.deepEqual([exact.RATE_LIMIT_DEFAULT_PER_MINUTE, exact.RATE_LIMIT_PUBLIC_PER_MINUTE], [120, 60]);
  assert.throws(() => validateEnv({ ...BASE, NODE_ENV: 'production', RATE_LIMIT_PUBLIC_PER_MINUTE: '61' }), /RATE_LIMIT_PUBLIC_PER_MINUTE/);
  assert.throws(() => validateEnv({ ...BASE, NODE_ENV: 'production', RATE_LIMIT_DEFAULT_PER_MINUTE: '121' }), /RATE_LIMIT_DEFAULT_PER_MINUTE/);
  assert.throws(() => validateEnv({ ...BASE, NODE_ENV: 'production', RATE_LIMIT_PUBLIC_PER_MINUTE: '100000' }), /RATE_LIMIT_PUBLIC_PER_MINUTE/);
});

test('a limit must be a whole number from 1 up', () => {
  for (const bad of ['0', '-1', '1.5', 'abc', '']) {
    assert.throws(() => validateEnv({ ...BASE, RATE_LIMIT_PUBLIC_PER_MINUTE: bad }), /RATE_LIMIT_PUBLIC_PER_MINUTE/, `"${bad}" is refused`);
  }
});
