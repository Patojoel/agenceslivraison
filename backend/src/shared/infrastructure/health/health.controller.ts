import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../db/create-pool';
import { requiredMigrations } from '../db/migrations';

@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
  @Get('live') live() { return { status: 'ok' }; }
  @Get('ready') async ready() {
    try {
      const required = requiredMigrations();
      const result = await this.pool.query<{ hash: string; created_at: string }>('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at');
      if (result.rows.length !== required.length || result.rows.some((row, index) => row.hash !== required[index].hash || Number(row.created_at) !== required[index].folderMillis)) throw new Error('Migration history mismatch');
      return { status: 'ok' };
    } catch { throw new ServiceUnavailableException('Database not ready'); }
  }
}
