import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { RateCardAlreadyExists, StaleRateCardVersion } from '../../../domain/exceptions/pricing.exceptions';
import { RateCardRepository } from '../../../domain/ports/rate-card.repository';
import { RateCard } from '../../../domain/rate-card';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { RateCardLineOrmEntity } from './rate-card-line.orm-entity';
import { RateCardVersionOrmEntity } from './rate-card-version.orm-entity';
import { RateCardOrmEntity } from './rate-card.orm-entity';
import { RateCardMapper } from './rate-card.mapper';

/**
 * Plain SQL on purpose: two creations at once must end with one row and one refusal, which `ON CONFLICT DO NOTHING`
 * says without making the transaction fail; the second one waits for the first to commit and then inserts nothing.
 */
const INSERT_CARD = `
  INSERT INTO rate_cards (id, agency_id, current_version, created_at)
  VALUES ($1::uuid, $2::uuid, $3::int, $4::timestamptz)
  ON CONFLICT (agency_id) DO NOTHING
  RETURNING id`;

/** The version in force moves by exactly one: the row it was loaded from is the one the update expects. */
const ADVANCE_VERSION = `
  UPDATE rate_cards SET current_version = $3::int
  WHERE id = $1::uuid AND agency_id = $2::uuid AND current_version = $4::int
  RETURNING id`;

@Injectable()
export class RateCardTypeOrmRepository implements RateCardRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  findByAgency(agencyId: AgencyId): Promise<RateCard | null> {
    return this.load(agencyId, false);
  }

  lockByAgency(agencyId: AgencyId): Promise<RateCard | null> {
    return this.load(agencyId, true);
  }

  private async load(agencyId: AgencyId, lock: boolean): Promise<RateCard | null> {
    const manager = await this.connection.manager();
    const card = await manager.findOne(RateCardOrmEntity, { where: { agencyId: agencyId.value }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!card) return null;
    const version = await manager.findOne(RateCardVersionOrmEntity, { where: { agencyId: agencyId.value, rateCardId: card.id, number: card.currentVersion } });
    if (!version) throw new Error('Rate card without its version in force');
    const lines = await manager.find(RateCardLineOrmEntity, { where: { agencyId: agencyId.value, rateCardId: card.id, versionNumber: card.currentVersion }, order: { zoneId: 'ASC', position: 'ASC' } });
    return RateCardMapper.toDomain(card, version, lines);
  }

  async add(card: RateCard): Promise<void> {
    const manager = await this.connection.manager();
    const row = RateCardMapper.cardToOrm(card);
    const inserted: { id: string }[] = await manager.query(INSERT_CARD, [row.id, row.agencyId, row.currentVersion, row.createdAt]);
    if (inserted.length === 0) throw new RateCardAlreadyExists();
    await this.insertVersion(card);
  }

  async save(card: RateCard): Promise<void> {
    const manager = await this.connection.manager();
    const { id, agencyId, current } = card.snapshot();
    const advanced: { id: string }[] = await manager.query(ADVANCE_VERSION, [id.value, agencyId.value, current.number, current.number - 1]);
    if (advanced.length === 0) throw new StaleRateCardVersion();
    await this.insertVersion(card);
  }

  /** Versions and their lines are only ever inserted. */
  private async insertVersion(card: RateCard): Promise<void> {
    const manager = await this.connection.manager();
    await manager.insert(RateCardVersionOrmEntity, RateCardMapper.versionToOrm(card));
    await manager.insert(RateCardLineOrmEntity, RateCardMapper.linesToOrm(card));
  }
}
