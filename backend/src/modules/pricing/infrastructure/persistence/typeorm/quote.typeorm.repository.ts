import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { QuoteAlreadyAccepted } from '../../../domain/exceptions/pricing.exceptions';
import { QuoteRepository } from '../../../domain/ports/quote.repository';
import { Quote } from '../../../domain/quote';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { QuoteId } from '../../../domain/value-objects/quote-id';
import { QuoteMapper } from './quote.mapper';
import { QuoteOrmEntity } from './quote.orm-entity';

/**
 * Plain SQL on purpose: the first emission of the year inserts the counter, every later one increments it, in the same
 * statement, and the row stays locked until the transaction ends, so the numbers are given one by one.
 */
const NEXT_NUMBER = `
  INSERT INTO quote_sequences (agency_id, year, last_number)
  VALUES ($1::uuid, $2::int, 1)
  ON CONFLICT (agency_id, year) DO UPDATE SET last_number = quote_sequences.last_number + 1
  RETURNING last_number`;

/** The acceptance only goes through from `issued`: a quote accepted meanwhile makes the statement touch no row. */
const ACCEPT = `
  UPDATE quotes SET status = 'accepted', accepted_at = $3::timestamptz, accepted_by = $4::uuid
  WHERE id = $1::uuid AND agency_id = $2::uuid AND status = 'issued'
  RETURNING id`;

@Injectable()
export class QuoteTypeOrmRepository implements QuoteRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async nextNumber(agencyId: AgencyId, year: number): Promise<number> {
    const manager = await this.connection.manager();
    const rows: { last_number: number }[] = await manager.query(NEXT_NUMBER, [agencyId.value, year]);
    const row = rows[0];
    if (!row) throw new Error('The counter of the quotes returned no number');
    return row.last_number;
  }

  async add(quote: Quote): Promise<void> {
    const manager = await this.connection.manager();
    await manager.insert(QuoteOrmEntity, QuoteMapper.toOrm(quote));
  }

  findById(agencyId: AgencyId, quoteId: QuoteId): Promise<Quote | null> {
    return this.load(agencyId, quoteId, false);
  }

  lockById(agencyId: AgencyId, quoteId: QuoteId): Promise<Quote | null> {
    return this.load(agencyId, quoteId, true);
  }

  private async load(agencyId: AgencyId, quoteId: QuoteId, lock: boolean): Promise<Quote | null> {
    const manager = await this.connection.manager();
    const row = await manager.findOne(QuoteOrmEntity, { where: { agencyId: agencyId.value, id: quoteId.value }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    return row ? QuoteMapper.toDomain(row) : null;
  }

  async save(quote: Quote): Promise<void> {
    const manager = await this.connection.manager();
    const { id, agencyId, acceptedAt, acceptedBy } = quote.snapshot();
    if (acceptedAt === null || acceptedBy === null) throw new Error('Only an accepted quote is saved');
    const accepted: { id: string }[] = await manager.query(ACCEPT, [id.value, agencyId.value, acceptedAt, acceptedBy.value]);
    if (accepted.length === 0) throw new QuoteAlreadyAccepted();
  }
}
