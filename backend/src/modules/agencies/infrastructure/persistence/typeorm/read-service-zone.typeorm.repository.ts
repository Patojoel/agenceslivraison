import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ListServiceZonesCriteria, ReadServiceZoneRepository } from '../../../application/ports/read-service-zone.repository';
import { ServiceZoneReadModel } from '../../../application/read-models/service-zone.read-model';

interface ZoneRow {
  id: string | null;
  city: string | null;
  district: string | null;
  addedAt: Date | null;
  retiredAt: Date | null;
}

/**
 * Starting from the membership makes the access check part of the same statement: no row at all means
 * unknown agency or no active membership; a member of an agency without zones gets one row of nulls.
 * The keyset compares the same expressions as the ORDER BY, against the row of the cursor taken in the same agency.
 */
const LIST = `
  SELECT z.id, z.city, z.district, z.added_at AS "addedAt", z.retired_at AS "retiredAt"
  FROM agency_memberships m
  LEFT JOIN service_zones z
    ON z.agency_id = m.agency_id
   AND ($3::uuid IS NULL OR (z.retired_at IS NOT NULL, z.city_key, z.district_key, z.id) > (
         SELECT c.retired_at IS NOT NULL, c.city_key, c.district_key, c.id
         FROM service_zones c
         WHERE c.id = $3::uuid AND c.agency_id = m.agency_id))
  WHERE m.agency_id = $1::uuid AND m.user_id = $2::uuid AND m.active
  ORDER BY (z.retired_at IS NOT NULL), z.city_key, z.district_key, z.id
  LIMIT $4`;

@Injectable()
export class ReadServiceZoneTypeOrmRepository implements ReadServiceZoneRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async listForMember(criteria: ListServiceZonesCriteria): Promise<readonly ServiceZoneReadModel[] | null> {
    const manager = await this.connection.manager();
    const rows: ZoneRow[] = await manager.query(LIST, [criteria.agencyId, criteria.userId, criteria.after, criteria.limit]);
    if (rows.length === 0) return null;
    return rows.flatMap(row => (row.id === null || row.city === null || row.addedAt === null ? [] : [{
      id: row.id,
      city: row.city,
      district: row.district,
      status: row.retiredAt === null ? 'active' as const : 'retired' as const,
      addedAt: row.addedAt.toISOString(),
      retiredAt: row.retiredAt?.toISOString() ?? null,
    }]));
  }
}
