import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { MIGRATIONS_TABLE, orderedMigrationNames } from '@config/typeorm.config';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';

@Controller('health')
export class HealthController {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Ready only when every migration file has run, in order, and nothing unknown has. */
  @Get('ready')
  async ready(): Promise<{ status: 'ok' }> {
    try {
      const dataSource = await this.connection.open();
      const expected = orderedMigrationNames(dataSource.migrations);
      const applied = await dataSource.query<{ name: string }[]>(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`);
      if (expected.length === 0 || applied.length !== expected.length || applied.some((row, index) => row.name !== expected[index])) {
        throw new Error('Migration history mismatch');
      }
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database not ready');
    }
  }
}
