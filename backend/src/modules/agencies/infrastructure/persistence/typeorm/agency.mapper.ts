import { Email } from '@shared/domain/value-objects/email';
import { UserId } from '@shared/domain/value-objects/user-id';
import { Agency } from '../../../domain/agency';
import { isAgencyStatus } from '../../../domain/agency.snapshot';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { Description } from '../../../domain/value-objects/description';
import { HeadquartersAddress } from '../../../domain/value-objects/headquarters-address';
import { HeadquartersCity } from '../../../domain/value-objects/headquarters-city';
import { LegalName } from '../../../domain/value-objects/legal-name';
import { Niu } from '../../../domain/value-objects/niu';
import { PrimaryPhone } from '../../../domain/value-objects/primary-phone';
import { Rccm } from '../../../domain/value-objects/rccm';
import { TradeName } from '../../../domain/value-objects/trade-name';
import { AgencyCapabilityTransitionOrmEntity } from './agency-capability-transition.orm-entity';
import { AgencyOrmEntity } from './agency.orm-entity';
import { AgencySiteOrmEntity } from './agency-site.orm-entity';
import { AgencySiteMapper, CapabilityTransitionMapper, ServiceZoneMapper } from './agency-configuration.mapper';
import { ServiceZoneOrmEntity } from './service-zone.orm-entity';

function ofOptional<T>(stored: string | null, of: (value: string) => T): T | null {
  return stored === null ? null : of(stored);
}

export class AgencyMapper {
  /** Identity and submission columns are left to their defaults: a new draft has none, and they change through later use cases. */
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

  /** The columns an identity or profile update may change; `null` is written as NULL, whereas TypeORM skips `undefined`. */
  static changes(agency: Agency): Partial<AgencyOrmEntity> {
    const { tradeName, description, identity, version } = agency.snapshot();
    return {
      tradeName: tradeName.value,
      description: description?.value ?? null,
      legalName: identity.legalName?.value ?? null,
      headquartersCity: identity.headquartersCity?.value ?? null,
      headquartersAddress: identity.headquartersAddress?.value ?? null,
      primaryPhone: identity.primaryPhone?.value ?? null,
      contactEmail: identity.contactEmail?.value ?? null,
      rccm: identity.rccm?.value ?? null,
      niu: identity.niu?.value ?? null,
      version,
    };
  }

  /** The rows of the zones, sites and capability transitions are those of the same agency, in the order of the transitions. */
  static toDomain(row: AgencyOrmEntity, configuration: { readonly zones: readonly ServiceZoneOrmEntity[]; readonly sites: readonly AgencySiteOrmEntity[]; readonly transitions: readonly AgencyCapabilityTransitionOrmEntity[] }): Agency {
    if (!isAgencyStatus(row.status)) throw new Error('Unknown agency status in database');
    return Agency.reconstitute({
      id: AgencyId.of(row.id),
      tradeName: TradeName.of(row.tradeName),
      description: ofOptional(row.description, Description.of),
      identity: {
        legalName: ofOptional(row.legalName, LegalName.of),
        headquartersCity: ofOptional(row.headquartersCity, HeadquartersCity.of),
        headquartersAddress: ofOptional(row.headquartersAddress, HeadquartersAddress.of),
        primaryPhone: ofOptional(row.primaryPhone, PrimaryPhone.of),
        contactEmail: ofOptional(row.contactEmail, Email.of),
        rccm: ofOptional(row.rccm, Rccm.of),
        niu: ofOptional(row.niu, Niu.of),
      },
      status: row.status,
      version: row.version,
      createdBy: UserId.of(row.createdBy),
      createdAt: row.createdAt,
      zones: configuration.zones.map(ServiceZoneMapper.toDomain),
      sites: configuration.sites.map(AgencySiteMapper.toDomain),
      capabilityTransitions: configuration.transitions.map(CapabilityTransitionMapper.toDomain),
    });
  }
}
