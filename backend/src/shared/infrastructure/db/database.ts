import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { SqlReader } from '../../application/ports/sql-reader';

/** Every query issued inside `transaction()` runs on the same client, whatever the caller. */
export class Database implements SqlReader {
  private readonly scope = new AsyncLocalStorage<PoolClient>();

  constructor(private readonly pool: Pool) {}

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.scope.getStore()) return work();
    const client = await this.pool.connect();
    let broken: Error | undefined;
    try {
      await client.query('BEGIN');
      const result = await this.scope.run(client, work);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch((rollbackError: Error) => { broken = rollbackError; });
      throw error;
    } finally {
      client.release(broken);
    }
  }

  execute<R extends QueryResultRow>(text: string, values: readonly unknown[]): Promise<QueryResult<R>> {
    return (this.scope.getStore() ?? this.pool).query<R>(text, [...values]);
  }

  async query<R extends object>(text: string, values: readonly unknown[]): Promise<R[]> {
    return (await this.execute<R & QueryResultRow>(text, values)).rows;
  }
}
