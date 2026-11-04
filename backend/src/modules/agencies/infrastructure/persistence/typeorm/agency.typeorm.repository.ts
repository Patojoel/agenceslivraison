import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { Agency } from '../../../domain/agency';
import { StaleAgencyVersion } from '../../../domain/exceptions/agency.exceptions';
import { AgencyRepository } from '../../../domain/ports/agency.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { AgencyMapper } from './agency.mapper';
import { AgencyOrmEntity } from './agency.orm-entity';

@Injectable()
export class AgencyTypeOrmRepository implements AgencyRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async add(agency: Agency): Promise<void> {
    const manager = await this.connection.manager();
    await manager.insert(AgencyOrmEntity, AgencyMapper.toOrm(agency));
  }

  async findById(id: AgencyId): Promise<Agency | null> {
    const manager = await this.connection.manager();
    const row = await manager.findOne(AgencyOrmEntity, { where: { id: id.value } });
    return row ? AgencyMapper.toDomain(row) : null;
  }

  /**
   * A modification raises the version by exactly one, so the row it was loaded from is the one at the
   * previous version: the condition turns a lost race into a refusal even if no lock were held.
   */
  async save(agency: Agency): Promise<void> {
    const manager = await this.connection.manager();
    const { id, version } = agency.snapshot();
    const result = await manager.update(AgencyOrmEntity, { id: id.value, version: version - 1 }, AgencyMapper.changes(agency));
    if (result.affected !== 1) throw new StaleAgencyVersion();
  }
}
