import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { Agency } from '../../../domain/agency';
import { AgencySnapshot } from '../../../domain/agency.snapshot';
import { AgencyAlreadySubmitted, StaleAgencyVersion, StaleSiteVersion } from '../../../domain/exceptions/agency.exceptions';
import { AgencyRepository } from '../../../domain/ports/agency.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { AgencyCapabilityTransitionOrmEntity } from './agency-capability-transition.orm-entity';
import { AgencySiteMapper, CapabilityTransitionMapper, ServiceZoneMapper } from './agency-configuration.mapper';
import { AgencySiteOrmEntity } from './agency-site.orm-entity';
import { AgencyMapper } from './agency.mapper';
import { AgencyOrmEntity } from './agency.orm-entity';
import { ServiceZoneOrmEntity } from './service-zone.orm-entity';

@Injectable()
export class AgencyTypeOrmRepository implements AgencyRepository {
  /** The agencies as loaded, so that save() writes only what the aggregate changed. */
  private readonly loaded = new WeakMap<Agency, AgencySnapshot>();

  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async add(agency: Agency): Promise<void> {
    const manager = await this.connection.manager();
    await manager.insert(AgencyOrmEntity, AgencyMapper.toOrm(agency));
  }

  async findById(id: AgencyId): Promise<Agency | null> {
    const manager = await this.connection.manager();
    const row = await manager.findOne(AgencyOrmEntity, { where: { id: id.value } });
    if (!row) return null;
    // One after the other: they share the connection of the transaction, which runs one statement at a time.
    const zones = await manager.find(ServiceZoneOrmEntity, { where: { agencyId: id.value }, order: { addedAt: 'ASC', id: 'ASC' } });
    const sites = await manager.find(AgencySiteOrmEntity, { where: { agencyId: id.value }, order: { createdAt: 'ASC', id: 'ASC' } });
    const transitions = await manager.find(AgencyCapabilityTransitionOrmEntity, { where: { agencyId: id.value }, order: { type: 'ASC', sequence: 'ASC' } });
    const agency = AgencyMapper.toDomain(row, { zones, sites, transitions });
    this.loaded.set(agency, agency.snapshot());
    return agency;
  }

  /**
   * The agency row only changes with its identity or profile, which raise the version by exactly one:
   * the row it was loaded from is the one at the previous version, so the condition turns a lost race
   * into a refusal even if no lock were held. Zones, sites and capability transitions are written
   * row by row from what changed; a site is also guarded by the version it was loaded at.
   */
  async save(agency: Agency): Promise<void> {
    const manager = await this.connection.manager();
    const now = agency.snapshot();
    const before = this.loaded.get(agency);
    if (!before || before.version !== now.version) {
      const result = await manager.update(AgencyOrmEntity, { id: now.id.value, version: now.version - 1 }, AgencyMapper.changes(agency));
      if (result.affected !== 1) throw new StaleAgencyVersion();
    }
    if (before && before.status !== now.status) {
      // Only a draft becomes submitted: a concurrent submission that got there first leaves no row to update.
      const result = await manager.update(AgencyOrmEntity, { id: now.id.value, status: before.status }, AgencyMapper.submission(agency));
      if (result.affected !== 1) throw new AgencyAlreadySubmitted();
    }
    const agencyId = now.id.value;
    const zonesBefore = new Map((before?.zones ?? []).map(zone => [zone.id.value, zone]));
    for (const zone of now.zones) {
      const previous = zonesBefore.get(zone.id.value);
      if (!previous) await manager.insert(ServiceZoneOrmEntity, ServiceZoneMapper.toOrm(agencyId, zone));
      else if (previous !== zone) await manager.update(ServiceZoneOrmEntity, { id: zone.id.value, agencyId }, ServiceZoneMapper.changes(zone));
    }
    const sitesBefore = new Map((before?.sites ?? []).map(site => [site.id.value, site]));
    for (const site of now.sites) {
      const previous = sitesBefore.get(site.id.value);
      if (!previous) {
        await manager.insert(AgencySiteOrmEntity, AgencySiteMapper.toOrm(agencyId, site));
      } else if (previous !== site) {
        const result = await manager.update(AgencySiteOrmEntity, { id: site.id.value, agencyId, version: previous.version }, AgencySiteMapper.changes(site));
        if (result.affected !== 1) throw new StaleSiteVersion();
      }
    }
    const known = before?.capabilityTransitions.length ?? 0;
    for (const transition of now.capabilityTransitions.slice(known)) {
      await manager.insert(AgencyCapabilityTransitionOrmEntity, CapabilityTransitionMapper.toOrm(agencyId, transition));
    }
    this.loaded.set(agency, now);
  }
}
