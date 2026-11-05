import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ReadAgencyPublicViewRepository } from '../../../application/ports/read-agency-public-view.repository';
import { AgencyPublicView } from '../../../application/read-models/agency-public-view.read-model';
import { CapabilityType, isCapabilityType } from '../../../domain/capability';

interface AgencyRow { trade_name: string; description: string | null; status: string }
interface ZoneRow { id: string; city: string; district: string | null }

/** `FOR NO KEY UPDATE` conflicts with the `FOR SHARE` of the other modules' writes and with the `FOR UPDATE` of `agencies`. */
const LOCK_FOR_PUBLICATION = 'SELECT id FROM agencies WHERE id = $1::uuid FOR NO KEY UPDATE';
const AGENCY = 'SELECT trade_name, description, status FROM agencies WHERE id = $1::uuid';
/** The state of a capability is its last transition. */
const ACTIVE_CAPABILITIES = `
  SELECT type FROM (
    SELECT DISTINCT ON (type) type, kind FROM agency_capability_transitions
    WHERE agency_id = $1::uuid ORDER BY type, sequence DESC
  ) AS last WHERE kind = 'activated' ORDER BY type`;
const ACTIVE_ZONES = `
  SELECT id, city, district FROM service_zones
  WHERE agency_id = $1::uuid AND retired_at IS NULL
  ORDER BY city_key, district_key, id`;
const ACTIVE_SITE_CITIES = `
  SELECT DISTINCT city FROM agency_sites
  WHERE agency_id = $1::uuid AND deactivated_at IS NULL
  ORDER BY city`;

@Injectable()
export class ReadAgencyPublicViewTypeOrmRepository implements ReadAgencyPublicViewRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async publicViewOf(agencyId: string): Promise<AgencyPublicView | null> {
    const manager = await this.connection.manager();
    // One after the other: they share the connection of the transaction, which runs one statement at a time.
    const agencies: AgencyRow[] = await manager.query(AGENCY, [agencyId]);
    const agency = agencies[0];
    if (agency === undefined) return null;
    const capabilities: { type: string }[] = await manager.query(ACTIVE_CAPABILITIES, [agencyId]);
    const zones: ZoneRow[] = await manager.query(ACTIVE_ZONES, [agencyId]);
    const cities: { city: string }[] = await manager.query(ACTIVE_SITE_CITIES, [agencyId]);
    return {
      submitted: agency.status === 'submitted',
      tradeName: agency.trade_name,
      description: agency.description,
      capabilities: capabilities.map(row => row.type).filter((type): type is CapabilityType => isCapabilityType(type)),
      zones: zones.map(zone => ({ id: zone.id, city: zone.city, district: zone.district })),
      siteCities: cities.map(row => row.city),
    };
  }

  async publicViewOfLockedForPublication(agencyId: string): Promise<AgencyPublicView | null> {
    const manager = await this.connection.manager();
    await manager.query(LOCK_FOR_PUBLICATION, [agencyId]);
    return this.publicViewOf(agencyId);
  }
}
