import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ReadAgencyDeliveryRepository } from '../../../application/ports/read-agency-delivery.repository';
import { AgencyDeliveryState } from '../../../application/read-models/agency-delivery.read-model';
import { AgencyRole, isAgencyRole } from '../../../domain/agency-role';

interface ZoneRow {
  id: string;
  city: string;
  district: string | null;
  active: boolean;
}

const ROLE = 'SELECT role FROM agency_memberships WHERE agency_id = $1::uuid AND user_id = $2::uuid AND active';
const LOCK_SHARED = 'SELECT id FROM agencies WHERE id = $1::uuid FOR SHARE';
const ZONES = `
  SELECT id, city, district, retired_at IS NULL AS active
  FROM service_zones
  WHERE agency_id = $1::uuid
  ORDER BY city_key, district_key, id`;
const DELIVERY_ACTIVE = `
  SELECT COALESCE((
    SELECT kind = 'activated' FROM agency_capability_transitions
    WHERE agency_id = $1::uuid AND type = $2
    ORDER BY sequence DESC LIMIT 1), false) AS active`;

@Injectable()
export class ReadAgencyDeliveryTypeOrmRepository implements ReadAgencyDeliveryRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async activeRoleOf(agencyId: string, userId: string): Promise<AgencyRole | null> {
    const manager = await this.connection.manager();
    const rows: { role: string }[] = await manager.query(ROLE, [agencyId, userId]);
    const role = rows[0]?.role;
    if (role === undefined) return null;
    if (!isAgencyRole(role)) throw new Error('Unknown agency role in database');
    return role;
  }

  async deliveryStateOf(agencyId: string): Promise<AgencyDeliveryState> {
    const manager = await this.connection.manager();
    // One after the other: they share the connection of the transaction, which runs one statement at a time.
    const zones: ZoneRow[] = await manager.query(ZONES, [agencyId]);
    const capability: { active: boolean }[] = await manager.query(DELIVERY_ACTIVE, [agencyId, 'delivery']);
    return {
      deliveryActive: capability[0]?.active === true,
      zones: zones.map(zone => ({ id: zone.id, city: zone.city, district: zone.district, active: zone.active })),
    };
  }

  async deliveryStateOfLockedShared(agencyId: string): Promise<AgencyDeliveryState> {
    const manager = await this.connection.manager();
    await manager.query(LOCK_SHARED, [agencyId]);
    return this.deliveryStateOf(agencyId);
  }
}
