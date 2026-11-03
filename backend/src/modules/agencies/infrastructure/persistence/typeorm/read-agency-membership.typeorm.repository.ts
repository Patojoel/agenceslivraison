import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ActiveMembershipsCriteria, ReadAgencyMembershipRepository } from '../../../application/ports/read-agency-membership.repository';
import { MyAgencyReadModel } from '../../../application/read-models/my-agency.read-model';
import { AgencyMembershipOrmEntity } from './agency-membership.orm-entity';

@Injectable()
export class ReadAgencyMembershipTypeOrmRepository implements ReadAgencyMembershipRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async listActiveForUser(criteria: ActiveMembershipsCriteria): Promise<readonly MyAgencyReadModel[]> {
    const manager = await this.connection.manager();
    const query = manager
      .createQueryBuilder(AgencyMembershipOrmEntity, 'membership')
      .select('membership.agencyId', 'agencyId')
      .addSelect('membership.role', 'role')
      .where('membership.userId = :userId', { userId: criteria.userId })
      .andWhere('membership.active = true');
    if (criteria.after !== null) query.andWhere('membership.agencyId > :after', { after: criteria.after });
    return query.orderBy('membership.agencyId').limit(criteria.limit).getRawMany<MyAgencyReadModel>();
  }
}
