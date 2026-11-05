import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ReadPublicPricingRepository } from '../../../application/ports/read-public-pricing.repository';

/** The lines of the version in force only, filtered by agency from the first table. */
const STARTING_PRICES = `
  SELECT line.zone_id AS zone_id, MIN(line.price_xaf)::int AS starting_price
  FROM rate_cards AS card
  JOIN rate_card_lines AS line
    ON line.agency_id = card.agency_id AND line.rate_card_id = card.id AND line.version_number = card.current_version
  WHERE card.agency_id = $1::uuid
  GROUP BY line.zone_id`;

@Injectable()
export class ReadPublicPricingTypeOrmRepository implements ReadPublicPricingRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async startingPricesByZone(agencyId: string): Promise<ReadonlyMap<string, number>> {
    const manager = await this.connection.manager();
    const rows: { zone_id: string; starting_price: number }[] = await manager.query(STARTING_PRICES, [agencyId]);
    return new Map(rows.map(row => [row.zone_id, row.starting_price]));
  }
}
