import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ListAgencySitesCriteria, ReadAgencySiteRepository } from '../../../application/ports/read-agency-site.repository';
import { AgencySiteReadModel } from '../../../application/read-models/agency-site.read-model';

interface SiteRow {
  id: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  createdAt: Date | null;
  deactivatedAt: Date | null;
  version: number | null;
}

/** Same shape as the zone list: the membership check and the keyset live in one statement. */
const LIST = `
  SELECT s.id, s.name, s.city, s.address, s.phone, s.created_at AS "createdAt", s.deactivated_at AS "deactivatedAt", s.version
  FROM agency_memberships m
  LEFT JOIN agency_sites s
    ON s.agency_id = m.agency_id
   AND ($3::uuid IS NULL OR (s.deactivated_at IS NOT NULL, s.name_key, s.id) > (
         SELECT c.deactivated_at IS NOT NULL, c.name_key, c.id
         FROM agency_sites c
         WHERE c.id = $3::uuid AND c.agency_id = m.agency_id))
  WHERE m.agency_id = $1::uuid AND m.user_id = $2::uuid AND m.active
  ORDER BY (s.deactivated_at IS NOT NULL), s.name_key, s.id
  LIMIT $4`;

@Injectable()
export class ReadAgencySiteTypeOrmRepository implements ReadAgencySiteRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async listForMember(criteria: ListAgencySitesCriteria): Promise<readonly AgencySiteReadModel[] | null> {
    const manager = await this.connection.manager();
    const rows: SiteRow[] = await manager.query(LIST, [criteria.agencyId, criteria.userId, criteria.after, criteria.limit]);
    if (rows.length === 0) return null;
    return rows.flatMap(row => (row.id === null || row.name === null || row.city === null || row.address === null || row.createdAt === null || row.version === null ? [] : [{
      id: row.id,
      name: row.name,
      city: row.city,
      address: row.address,
      phone: row.phone,
      status: row.deactivatedAt === null ? 'active' as const : 'inactive' as const,
      createdAt: row.createdAt.toISOString(),
      deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
      version: row.version,
    }]));
  }
}
