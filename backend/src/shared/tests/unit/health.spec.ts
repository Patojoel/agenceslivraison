import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import { TypeOrmDatabaseConnection } from '../../infrastructure/persistence/typeorm/typeorm-database-connection';
import { HealthController } from '../../presentation/health/health.controller';

const BASELINE = { name: 'Baseline1793710789928' };

function controller(open: () => Promise<Pick<DataSource, 'migrations' | 'query'>>): HealthController {
  return new HealthController({ open } as unknown as TypeOrmDatabaseConnection);
}

const dataSource = (rows: { name: string }[]) => async () => ({
  migrations: [BASELINE],
  query: async () => rows,
}) as unknown as Pick<DataSource, 'migrations' | 'query'>;

test('liveness does not require a database', () => {
  assert.deepEqual(controller(async () => { throw new Error('database down'); }).live(), { status: 'ok' });
});

test('readiness fails closed when database is unavailable', async () => {
  await assert.rejects(controller(async () => { throw new Error('database down'); }).ready(), { status: 503 });
});

test('readiness fails when migration has not run', async () => {
  await assert.rejects(controller(dataSource([])).ready(), { status: 503 });
});

test('readiness fails when the applied history differs from the files', async () => {
  await assert.rejects(controller(dataSource([{ name: 'Changed1793710789928' }])).ready(), { status: 503 });
});

test('readiness succeeds once every migration has run', async () => {
  assert.deepEqual(await controller(dataSource([BASELINE])).ready(), { status: 'ok' });
});

test('readiness does not depend on the order in which migration files are discovered', async () => {
  const later = { name: 'Later1793777474207' };
  const open = async () => ({ migrations: [later, BASELINE], query: async () => [BASELINE, later] }) as unknown as Pick<DataSource, 'migrations' | 'query'>;
  assert.deepEqual(await controller(open).ready(), { status: 'ok' });
});
