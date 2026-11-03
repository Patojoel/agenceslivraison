import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import { TypeOrmDatabaseConnection } from '../../infrastructure/persistence/typeorm/typeorm-database-connection';

/** Reproduces TypeORM: `isInitialized` turns true before `initialize()` has resolved. */
class FakeDataSource {
  isInitialized = false;
  initializeCalls = 0;
  failNext = false;
  private release: (() => void) | null = null;

  initialize(): Promise<this> {
    this.initializeCalls++;
    this.isInitialized = true;
    return new Promise<this>((resolve, reject) => {
      this.release = () => {
        if (this.failNext) {
          this.failNext = false;
          this.isInitialized = false;
          reject(new Error('connection refused'));
        } else resolve(this);
      };
    });
  }

  finish(): void { this.release?.(); }
}

const connectionOver = (source: FakeDataSource) => new TypeOrmDatabaseConnection(source as unknown as DataSource);
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('a concurrent open waits for initialize() to resolve', async () => {
  const source = new FakeDataSource();
  const connection = connectionOver(source);
  let secondResolved = false;
  const first = connection.open();
  const second = connection.open().then(() => { secondResolved = true; });
  await tick();
  assert.equal(secondResolved, false, 'must not hand out a half-initialized source');
  source.finish();
  await Promise.all([first, second]);
  assert.equal(source.initializeCalls, 1);
});

test('an initialized source is reused without a new initialization', async () => {
  const source = new FakeDataSource();
  const connection = connectionOver(source);
  const first = connection.open();
  source.finish();
  await first;
  await connection.open();
  assert.equal(source.initializeCalls, 1);
});

test('open can be retried after a failure', async () => {
  const source = new FakeDataSource();
  source.failNext = true;
  const connection = connectionOver(source);
  const failing = connection.open();
  source.finish();
  await assert.rejects(failing, /connection refused/);
  const retry = connection.open();
  source.finish();
  await retry;
  assert.equal(source.initializeCalls, 2);
});
