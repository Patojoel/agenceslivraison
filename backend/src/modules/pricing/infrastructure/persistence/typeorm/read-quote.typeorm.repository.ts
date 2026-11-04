import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { ListQuotesCriteria, ReadQuoteRepository } from '../../../application/ports/read-quote.repository';
import { QuoteRecord, QuoteSummaryRecord } from '../../../application/read-models/quote.read-model';
import { QuoteParcel } from '../../../domain/quote';

interface QuoteRow {
  id: string;
  reference: string;
  recipientName: string;
  recipientPhone: string | null;
  zoneId: string;
  zoneCity: string;
  zoneDistrict: string | null;
  parcels: QuoteParcel[];
  rateCardVersion: number | null;
  pricing: 'priced' | 'out_of_scale' | 'no_tariff';
  calculatedTotal: number | null;
  manualPrice: number | null;
  manualPriceReason: string | null;
  total: number;
  issuedAt: Date;
  issuedBy: string;
  validUntil: Date;
  status: 'issued' | 'accepted';
  acceptedAt: Date | null;
  acceptedBy: string | null;
}

type SummaryRow = Pick<QuoteRow, 'id' | 'reference' | 'recipientName' | 'zoneId' | 'zoneCity' | 'zoneDistrict' | 'total' | 'issuedAt' | 'validUntil' | 'status' | 'acceptedAt'>;

/** Every statement starts from the agency of the path: a quote of another agency is never reachable by its identifier. */
const FIND = `
  SELECT id, reference, recipient_name AS "recipientName", recipient_phone AS "recipientPhone", zone_id AS "zoneId",
    zone_city AS "zoneCity", zone_district AS "zoneDistrict", parcels, rate_card_version AS "rateCardVersion",
    pricing_status AS pricing, calculated_total_xaf AS "calculatedTotal", manual_price_xaf AS "manualPrice",
    manual_price_reason AS "manualPriceReason", total_xaf AS total, issued_at AS "issuedAt", issued_by AS "issuedBy",
    valid_until AS "validUntil", status, accepted_at AS "acceptedAt", accepted_by AS "acceptedBy"
  FROM quotes
  WHERE agency_id = $1::uuid AND id = $2::uuid`;

const SUMMARY_COLUMNS = `
  SELECT id, reference, recipient_name AS "recipientName", zone_id AS "zoneId", zone_city AS "zoneCity", zone_district AS "zoneDistrict",
    total_xaf AS total, issued_at AS "issuedAt", valid_until AS "validUntil", status, accepted_at AS "acceptedAt"
  FROM quotes`;

/** Keyset pagination on the index `(agency_id, issued_at, id)`, scanned backwards. */
const FIRST_PAGE = `${SUMMARY_COLUMNS}
  WHERE agency_id = $1::uuid
  ORDER BY issued_at DESC, id DESC
  LIMIT $2::int`;

const NEXT_PAGE = `${SUMMARY_COLUMNS}
  WHERE agency_id = $1::uuid AND (issued_at, id) < ($3::timestamptz, $4::uuid)
  ORDER BY issued_at DESC, id DESC
  LIMIT $2::int`;

@Injectable()
export class ReadQuoteTypeOrmRepository implements ReadQuoteRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async findRecord(agencyId: string, quoteId: string): Promise<QuoteRecord | null> {
    const manager = await this.connection.manager();
    const rows: QuoteRow[] = await manager.query(FIND, [agencyId, quoteId]);
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      issuedAt: row.issuedAt.toISOString(),
      validUntil: row.validUntil.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
    };
  }

  async listSummaries(criteria: ListQuotesCriteria): Promise<readonly QuoteSummaryRecord[]> {
    const manager = await this.connection.manager();
    const rows: SummaryRow[] = criteria.after === null
      ? await manager.query(FIRST_PAGE, [criteria.agencyId, criteria.limit])
      : await manager.query(NEXT_PAGE, [criteria.agencyId, criteria.limit, criteria.after.issuedAt, criteria.after.id]);
    return rows.map(row => ({ ...row, issuedAt: row.issuedAt.toISOString(), validUntil: row.validUntil.toISOString(), acceptedAt: row.acceptedAt?.toISOString() ?? null }));
  }
}
