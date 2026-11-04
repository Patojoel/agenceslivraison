import { Agency } from '../../../domain/agency';
import { AgencyOrmEntity } from './agency.orm-entity';

export class AgencyMapper {
  /** Identity and submission columns are left to their defaults: they only change through later use cases. */
  static toOrm(agency: Agency): AgencyOrmEntity {
    const snapshot = agency.snapshot();
    const entity = new AgencyOrmEntity();
    entity.id = snapshot.id.value;
    entity.tradeName = snapshot.tradeName.value;
    entity.status = snapshot.status;
    entity.version = snapshot.version;
    entity.createdBy = snapshot.createdBy.value;
    entity.createdAt = snapshot.createdAt;
    return entity;
  }
}
