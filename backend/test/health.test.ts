import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { HealthController } from '../src/health.controller';

test('liveness does not require a database', () => {
  const pool = { query: () => { throw new Error('database down'); } } as unknown as Pool;
  assert.deepEqual(new HealthController(pool).live(), { status: 'ok' });
});
test('readiness fails closed when database is unavailable', async () => {
  const pool = { query: async () => { throw new Error('database down'); } } as unknown as Pool;
  await assert.rejects(new HealthController(pool).ready(), { status: 503 });
});
test('readiness fails when migration has not run', async () => {
  const pool = { query: async () => ({ rows: [{ installed: false }] }) } as unknown as Pool;
  await assert.rejects(new HealthController(pool).ready(), { status: 503 });
});
