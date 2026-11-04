import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ReadAgencyOnboardingRepository } from '../../../application/ports/read-agency-onboarding.repository';
import { AgencyOnboardingReadModel, CapabilityStateReadModel } from '../../../application/read-models/agency-onboarding.read-model';
import { isAgencyStatus } from '../../../domain/agency.snapshot';
import { isCapabilityType } from '../../../domain/capability';
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
  activeZones: number;
  activeSites: number;
}

interface CapabilityRow {
  type: string;
  kind: string;
  reason: string | null;
  occurredAt: Date;
}

/** The last transition of each capability is its current state. */
const CAPABILITIES = `
  SELECT DISTINCT ON (type) type, kind, reason, occurred_at AS "occurredAt"
  FROM agency_capability_transitions
  WHERE agency_id = $1::uuid
  ORDER BY type, sequence DESC`;

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
      .addSelect('(SELECT count(*)::int FROM service_zones zone WHERE zone.agency_id = agency.id AND zone.retired_at IS NULL)', 'activeZones')
      .addSelect('(SELECT count(*)::int FROM agency_sites site WHERE site.agency_id = agency.id AND site.deactivated_at IS NULL)', 'activeSites')
      .where('agency.id = :agencyId', { agencyId })
      .andWhere('membership.userId = :userId', { userId })
      .getRawOne<OnboardingRow>();
    if (!row) return null;
    if (!isAgencyStatus(row.status)) throw new Error('Unknown agency status in database');
    const capabilities: CapabilityRow[] = await manager.query(CAPABILITIES, [agencyId]);
    return {
      status: row.status,
      submission: row.submittedAt && row.submittedBy ? { submittedAt: row.submittedAt.toISOString(), submittedBy: row.submittedBy } : null,
      identity: { legalName: row.legalName, headquartersCity: row.headquartersCity, headquartersAddress: row.headquartersAddress, primaryPhone: row.primaryPhone },
      capabilities: capabilities.map(toCapabilityState),
      activeZones: row.activeZones,
      activeSites: row.activeSites,
    };
  }
}

function toCapabilityState(row: CapabilityRow): CapabilityStateReadModel {
  if (!isCapabilityType(row.type)) throw new Error('Unknown capability type in database');
  const active = row.kind === 'activated';
  return { type: row.type, state: active ? 'active' : 'suspended', since: row.occurredAt.toISOString(), reason: active ? null : row.reason, acceptsNewRequests: active };
}
