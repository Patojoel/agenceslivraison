import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ListVersionsCriteria, ReadRateCardRepository } from '../../../application/ports/read-rate-card.repository';
import { LineRecord, RateCardVersionRecord, VersionSummaryReadModel } from '../../../application/read-models/rate-card.read-model';

interface VersionRow {
  rateCardId: string;
  number: number;
  createdAt: Date;
  createdBy: string;
  volumetricDivisor: number | null;
}

interface LineRow {
  zoneId: string;
  upToGrams: number;
  price: number;
}

interface SummaryRow extends VersionRow {
  zoneCount: number;
}

/** Starts from the rate card of the agency, so the filter on the agency is the first thing every statement applies. */
const FIND_VERSION = `
  SELECT c.id AS "rateCardId", v.number, v.created_at AS "createdAt", v.created_by AS "createdBy", v.volumetric_divisor AS "volumetricDivisor"
  FROM rate_cards c
  JOIN rate_card_versions v ON v.agency_id = c.agency_id AND v.rate_card_id = c.id AND v.number = COALESCE($2::int, c.current_version)
  WHERE c.agency_id = $1::uuid`;

const LINES = `
  SELECT zone_id AS "zoneId", max_weight_grams AS "upToGrams", price_xaf AS price
  FROM rate_card_lines
  WHERE agency_id = $1::uuid AND rate_card_id = $2::uuid AND version_number = $3::int
  ORDER BY zone_id, position`;

const LIST = `
  SELECT c.id AS "rateCardId", v.number, v.created_at AS "createdAt", v.created_by AS "createdBy", v.volumetric_divisor AS "volumetricDivisor",
    (SELECT count(DISTINCT l.zone_id)::int FROM rate_card_lines l
      WHERE l.agency_id = v.agency_id AND l.rate_card_id = v.rate_card_id AND l.version_number = v.number) AS "zoneCount"
  FROM rate_cards c
  JOIN rate_card_versions v ON v.agency_id = c.agency_id AND v.rate_card_id = c.id
  WHERE c.agency_id = $1::uuid AND ($2::int IS NULL OR v.number < $2::int)
  ORDER BY v.number DESC
  LIMIT $3::int`;

function groupByZone(rows: readonly LineRow[]): LineRecord[] {
  const lines: LineRecord[] = [];
  for (const row of rows) {
    const tier = { upToGrams: row.upToGrams, price: row.price };
    const last = lines[lines.length - 1];
    if (last && last.zoneId === row.zoneId) lines[lines.length - 1] = { zoneId: last.zoneId, tiers: [...last.tiers, tier] };
    else lines.push({ zoneId: row.zoneId, tiers: [tier] });
  }
  return lines;
}

@Injectable()
export class ReadRateCardTypeOrmRepository implements ReadRateCardRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async findVersion(agencyId: string, number: number | null): Promise<RateCardVersionRecord | null> {
    const manager = await this.connection.manager();
    const versions: VersionRow[] = await manager.query(FIND_VERSION, [agencyId, number]);
    const version = versions[0];
    if (!version) return null;
    const rows: LineRow[] = await manager.query(LINES, [agencyId, version.rateCardId, version.number]);
    return {
      rateCardId: version.rateCardId,
      number: version.number,
      createdAt: version.createdAt.toISOString(),
      createdBy: version.createdBy,
      volumetricDivisor: version.volumetricDivisor,
      lines: groupByZone(rows),
    };
  }

  async listVersions(criteria: ListVersionsCriteria): Promise<readonly VersionSummaryReadModel[]> {
    const manager = await this.connection.manager();
    const rows: SummaryRow[] = await manager.query(LIST, [criteria.agencyId, criteria.before, criteria.limit]);
    return rows.map(row => ({ number: row.number, createdAt: row.createdAt.toISOString(), createdBy: row.createdBy, volumetricDivisor: row.volumetricDivisor, zoneCount: row.zoneCount }));
  }
}
