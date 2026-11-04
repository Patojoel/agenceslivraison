import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ReadAgencyRepository } from '../../../application/ports/read-agency.repository';
import { AgencyReadModel, MemberAgencyReadModel } from '../../../application/read-models/agency.read-model';
import { isAgencyRole } from '../../../domain/agency-role';
import { isAgencyStatus } from '../../../domain/agency.snapshot';
import { AgencyMembershipOrmEntity } from './agency-membership.orm-entity';
import { AgencyOrmEntity } from './agency.orm-entity';

@Injectable()
export class ReadAgencyTypeOrmRepository implements ReadAgencyRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  /** Membership is checked in the same statement as the read, which also returns the reader's role: no row means unknown agency or no access, indistinguishably. */
  async findForMember(agencyId: string, userId: string): Promise<MemberAgencyReadModel | null> {
    const manager = await this.connection.manager();
    const { entities, raw } = await manager
      .createQueryBuilder(AgencyOrmEntity, 'agency')
      .innerJoin(AgencyMembershipOrmEntity, 'membership', 'membership.agencyId = agency.id AND membership.active = true')
      .where('agency.id = :agencyId', { agencyId })
      .andWhere('membership.userId = :userId', { userId })
      .addSelect('membership.role', 'reader_role')
      .getRawAndEntities<{ reader_role: string }>();
    const row = entities[0];
    const readerRole = raw[0]?.reader_role;
    if (!row || readerRole === undefined) return null;
    if (!isAgencyRole(readerRole)) throw new Error('Unknown agency role in database');
    if (!isAgencyStatus(row.status)) throw new Error('Unknown agency status in database');
    const agency: AgencyReadModel = {
      id: row.id,
      status: row.status,
      tradeName: row.tradeName,
      description: row.description,
      identity: {
        legalName: row.legalName,
        headquartersCity: row.headquartersCity,
        headquartersAddress: row.headquartersAddress,
        primaryPhone: row.primaryPhone,
        contactEmail: row.contactEmail,
        rccm: row.rccm,
        niu: row.niu,
      },
      version: row.version,
    };
    return { role: readerRole, agency };
  }
}
