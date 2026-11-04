import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ReadAgencyOnboardingRepository } from '../../../application/ports/read-agency-onboarding.repository';
import { AgencyOnboardingReadModel } from '../../../application/read-models/agency-onboarding.read-model';
import { AGENCY_STATUSES, AgencyStatus } from '../../../domain/agency.snapshot';
import { AgencyMembershipOrmEntity } from './agency-membership.orm-entity';
import { AgencyOrmEntity } from './agency.orm-entity';

interface OnboardingRow {
  status: string;
  submittedAt: Date | null;
  submittedBy: string | null;
  legalName: boolean;
  headquartersCity: boolean;
  headquartersAddress: boolean;
  primaryPhone: boolean;
}

const isAgencyStatus = (value: string): value is AgencyStatus => AGENCY_STATUSES.some(status => status === value);

@Injectable()
export class ReadAgencyOnboardingTypeOrmRepository implements ReadAgencyOnboardingRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  /** Membership is checked in the same statement as the read: no row means unknown agency or no access, indistinguishably. */
  async findForMember(agencyId: string, userId: string): Promise<AgencyOnboardingReadModel | null> {
    const manager = await this.connection.manager();
    const row = await manager
      .createQueryBuilder(AgencyOrmEntity, 'agency')
      .innerJoin(AgencyMembershipOrmEntity, 'membership', 'membership.agencyId = agency.id AND membership.active = true')
      .select('agency.status', 'status')
      .addSelect('agency.submittedAt', 'submittedAt')
      .addSelect('agency.submittedBy', 'submittedBy')
      .addSelect('agency.legalName IS NOT NULL', 'legalName')
      .addSelect('agency.headquartersCity IS NOT NULL', 'headquartersCity')
      .addSelect('agency.headquartersAddress IS NOT NULL', 'headquartersAddress')
      .addSelect('agency.primaryPhone IS NOT NULL', 'primaryPhone')
      .where('agency.id = :agencyId', { agencyId })
      .andWhere('membership.userId = :userId', { userId })
      .getRawOne<OnboardingRow>();
    if (!row) return null;
    if (!isAgencyStatus(row.status)) throw new Error('Unknown agency status in database');
    return {
      status: row.status,
      submission: row.submittedAt && row.submittedBy ? { submittedAt: row.submittedAt.toISOString(), submittedBy: row.submittedBy } : null,
      identity: { legalName: row.legalName, headquartersCity: row.headquartersCity, headquartersAddress: row.headquartersAddress, primaryPhone: row.primaryPhone },
      capabilities: [],
      activeZones: 0,
      activeSites: 0,
    };
  }
}
