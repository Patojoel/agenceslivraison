import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { Agency } from '../../../domain/agency';
import { AgencyRepository } from '../../../domain/ports/agency.repository';
import { AgencyMapper } from './agency.mapper';
import { AgencyOrmEntity } from './agency.orm-entity';

@Injectable()
export class AgencyTypeOrmRepository implements AgencyRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async add(agency: Agency): Promise<void> {
    const manager = await this.connection.manager();
    await manager.insert(AgencyOrmEntity, AgencyMapper.toOrm(agency));
  }
}
