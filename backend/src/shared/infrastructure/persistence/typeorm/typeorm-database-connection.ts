import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Opens the data source on first use rather than at boot, and propagates the current transaction:
 * every repository called inside `transaction()` gets the same EntityManager, whatever the caller.
 */
@Injectable()
export class TypeOrmDatabaseConnection {
  private readonly scope = new AsyncLocalStorage<EntityManager>();
  private opening: Promise<DataSource> | null = null;
  private ready = false;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * TypeORM sets `isInitialized` before `initialize()` has built the metadata, so readiness is only
   * trusted once the promise resolved; concurrent callers share it. Retried after a failure, so the
   * API recovers once PostgreSQL is back.
   */
  async open(): Promise<DataSource> {
    if (this.ready && this.dataSource.isInitialized) return this.dataSource;
    this.opening ??= this.dataSource.initialize()
      .then(() => { this.ready = true; return this.dataSource; })
      .finally(() => { this.opening = null; });
    return this.opening;
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.scope.getStore()) return work();
    const dataSource = await this.open();
    return dataSource.transaction(manager => this.scope.run(manager, work));
  }

  /** The transaction's manager inside `transaction()`, the shared one otherwise. */
  async manager(): Promise<EntityManager> {
    return this.scope.getStore() ?? (await this.open()).manager;
  }
}
