import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencySite } from '../../../domain/agency-site';
import { CapabilityTransition, isCapabilityType } from '../../../domain/capability';
import { ServiceZone } from '../../../domain/service-zone';
import { AgencySiteId } from '../../../domain/value-objects/agency-site-id';
import { ServiceArea } from '../../../domain/value-objects/service-area';
import { ServiceZoneId } from '../../../domain/value-objects/service-zone-id';
import { SiteAddress } from '../../../domain/value-objects/site-address';
import { SiteCity } from '../../../domain/value-objects/site-city';
import { SiteName } from '../../../domain/value-objects/site-name';
import { SitePhone } from '../../../domain/value-objects/site-phone';
import { SuspensionReason } from '../../../domain/value-objects/suspension-reason';
import { AgencyCapabilityTransitionOrmEntity } from './agency-capability-transition.orm-entity';
import { AgencySiteOrmEntity } from './agency-site.orm-entity';
import { ServiceZoneOrmEntity } from './service-zone.orm-entity';

export class ServiceZoneMapper {
  static toOrm(agencyId: string, zone: ServiceZone): ServiceZoneOrmEntity {
    const entity = new ServiceZoneOrmEntity();
    entity.id = zone.id.value;
    entity.agencyId = agencyId;
    entity.city = zone.area.city;
    entity.district = zone.area.district;
    entity.cityKey = zone.area.cityKey;
    entity.districtKey = zone.area.districtKey;
    entity.addedAt = zone.addedAt;
    entity.retiredAt = zone.retiredAt;
    return entity;
  }

  static toDomain(row: ServiceZoneOrmEntity): ServiceZone {
    return { id: ServiceZoneId.of(row.id), area: ServiceArea.of(row.city, row.district), addedAt: row.addedAt, retiredAt: row.retiredAt };
  }
}

export class AgencySiteMapper {
  static toOrm(agencyId: string, site: AgencySite): AgencySiteOrmEntity {
    const entity = new AgencySiteOrmEntity();
    entity.id = site.id.value;
    entity.agencyId = agencyId;
    entity.name = site.name.value;
    entity.nameKey = site.name.key;
    entity.city = site.city.value;
    entity.address = site.address.value;
    entity.phone = site.phone?.value ?? null;
    entity.createdAt = site.createdAt;
    entity.deactivatedAt = site.deactivatedAt;
    entity.version = site.version;
    return entity;
  }

  /** The columns a modification may change; `null` is written as NULL, whereas TypeORM skips `undefined`. */
  static changes(site: AgencySite): Partial<AgencySiteOrmEntity> {
    return {
      name: site.name.value, nameKey: site.name.key, city: site.city.value, address: site.address.value,
      phone: site.phone?.value ?? null, deactivatedAt: site.deactivatedAt, version: site.version,
    };
  }

  static toDomain(row: AgencySiteOrmEntity): AgencySite {
    return {
      id: AgencySiteId.of(row.id),
      name: SiteName.of(row.name),
      city: SiteCity.of(row.city),
      address: SiteAddress.of(row.address),
      phone: row.phone === null ? null : SitePhone.of(row.phone),
      createdAt: row.createdAt,
      deactivatedAt: row.deactivatedAt,
      version: row.version,
    };
  }
}

export class CapabilityTransitionMapper {
  static toOrm(agencyId: string, transition: CapabilityTransition): AgencyCapabilityTransitionOrmEntity {
    const entity = new AgencyCapabilityTransitionOrmEntity();
    entity.agencyId = agencyId;
    entity.type = transition.type;
    entity.sequence = transition.sequence;
    entity.kind = transition.kind;
    entity.reason = transition.reason?.value ?? null;
    entity.actorId = transition.actorId.value;
    entity.occurredAt = transition.occurredAt;
    return entity;
  }

  static toDomain(row: AgencyCapabilityTransitionOrmEntity): CapabilityTransition {
    if (!isCapabilityType(row.type)) throw new Error('Unknown capability type in database');
    if (row.kind !== 'activated' && row.kind !== 'suspended') throw new Error('Unknown capability transition in database');
    return {
      type: row.type,
      kind: row.kind,
      sequence: row.sequence,
      occurredAt: row.occurredAt,
      actorId: UserId.of(row.actorId),
      reason: row.reason === null ? null : SuspensionReason.of(row.reason),
    };
  }
}
