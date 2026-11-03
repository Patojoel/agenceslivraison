import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';

export const DATABASE_POOL = Symbol('DATABASE_POOL');
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
  @Get('live') live() { return { status: 'ok' }; }
  @Get('ready') async ready() {
    try {
      const result = await this.pool.query<{ installed: boolean }>("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations') AS installed");
      if (!result.rows[0]?.installed) throw new Error('migration missing');
      const migration = await this.pool.query("SELECT 1 FROM schema_migrations WHERE version = $1", ['0001_initial']);
      if (migration.rowCount !== 1) throw new Error('migration missing');
      return { status: 'ok' };
    } catch { throw new ServiceUnavailableException('Database not ready'); }
  }
}
