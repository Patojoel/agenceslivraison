import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ActiveMembersCriteria, ReadAgencyMemberRepository } from '../../../application/ports/read-agency-member.repository';
import { AgencyMemberReadModel } from '../../../application/read-models/agency-member.read-model';
import { AgencyMembershipOrmEntity } from './agency-membership.orm-entity';

@Injectable()
export class ReadAgencyMemberTypeOrmRepository implements ReadAgencyMemberRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  /** The reader's own active membership is a condition of the same statement: without it no row comes back, whatever the agency. */
  async listActiveForMember(criteria: ActiveMembersCriteria): Promise<readonly AgencyMemberReadModel[]> {
    const manager = await this.connection.manager();
    const query = manager
      .createQueryBuilder(AgencyMembershipOrmEntity, 'member')
      .select('member.id', 'membershipId')
      .addSelect('member.userId', 'userId')
      .addSelect('member.role', 'role')
      .where('member.agencyId = :agencyId', { agencyId: criteria.agencyId })
      .andWhere('member.active = true')
      .andWhere(
        'EXISTS (SELECT 1 FROM agency_memberships reader WHERE reader.agency_id = member.agency_id AND reader.user_id = :userId AND reader.active = true)',
        { userId: criteria.userId },
      );
    if (criteria.after !== null) query.andWhere('member.id > :after', { after: criteria.after });
    return query.orderBy('member.id').limit(criteria.limit).getRawMany<AgencyMemberReadModel>();
  }

  async isActiveMember(agencyId: string, userId: string): Promise<boolean> {
    const manager = await this.connection.manager();
    return manager.exists(AgencyMembershipOrmEntity, { where: { agencyId, userId, active: true } });
  }
}
