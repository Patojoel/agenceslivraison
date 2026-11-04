import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { QuoteParcel } from '../../../domain/quote';

/**
 * A quote, written with a full copy of its calculation: nothing here follows the rate card or the zone afterwards. The
 * only update the repository ever makes is the acceptance, and only from `issued`. The parcels are one array in a `jsonb`
 * column: they are read and written with the quote and never searched. Every amount is a whole number of francs and the
 * checks tie the total to the price retained, so a row that contradicts itself cannot be written.
 * `(agency_id, zone_id)` references `service_zones(agency_id, id)`: a quote cannot name a zone of another agency.
 */
@Entity({ name: 'quotes' })
@Index('quotes_agency_reference_unique', ['agencyId', 'reference'], { unique: true })
@Index('quotes_agency_issued_at_id_idx', ['agencyId', 'issuedAt', 'id'])
@Check('quotes_reference_format', `"reference" ~ '^DEV-[0-9]{4}-[0-9]{6}$'`)
@Check('quotes_recipient_name_length', `char_length("recipient_name") BETWEEN 2 AND 120`)
@Check('quotes_recipient_phone_format', `"recipient_phone" IS NULL OR "recipient_phone" ~ '^[+]237[26][0-9]{8}$'`)
@Check('quotes_parcels_array', `jsonb_typeof("parcels") = 'array' AND jsonb_array_length("parcels") BETWEEN 1 AND 20`)
@Check('quotes_rate_card_version_positive', `"rate_card_version" IS NULL OR "rate_card_version" > 0`)
@Check('quotes_pricing_status_values', `"pricing_status" IN ('priced', 'out_of_scale', 'no_tariff')`)
@Check('quotes_calculated_total_when_priced', `("pricing_status" = 'priced') = ("calculated_total_xaf" IS NOT NULL)`)
@Check('quotes_calculated_total_range', `"calculated_total_xaf" IS NULL OR "calculated_total_xaf" BETWEEN 1 AND 200000000`)
@Check('quotes_manual_price_range', `"manual_price_xaf" IS NULL OR "manual_price_xaf" BETWEEN 1 AND 10000000`)
@Check('quotes_manual_reason_length', `"manual_price_reason" IS NULL OR char_length("manual_price_reason") BETWEEN 3 AND 300`)
@Check('quotes_manual_price_with_reason', `("manual_price_xaf" IS NULL) = ("manual_price_reason" IS NULL)`)
@Check('quotes_total_range', `"total_xaf" BETWEEN 1 AND 200000000`)
@Check('quotes_priced_by_calculation_or_by_hand', `"manual_price_xaf" IS NOT NULL OR "calculated_total_xaf" IS NOT NULL`)
@Check('quotes_total_is_price_retained', `"total_xaf" = COALESCE("manual_price_xaf", "calculated_total_xaf")`)
@Check('quotes_validity_after_issue', `"valid_until" > "issued_at"`)
@Check('quotes_status_values', `"status" IN ('issued', 'accepted')`)
@Check('quotes_acceptance_complete', `("status" = 'accepted') = ("accepted_at" IS NOT NULL) AND ("accepted_at" IS NULL) = ("accepted_by" IS NULL)`)
@Check('quotes_accepted_within_validity', `"accepted_at" IS NULL OR ("accepted_at" >= "issued_at" AND "accepted_at" <= "valid_until")`)
export class QuoteOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'quotes_pkey' })
  id: string;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'quotes_agency_id_agencies_id_fk' })
  agency?: object;

  @Column({ type: 'text' })
  reference: string;

  @Column({ name: 'recipient_name', type: 'text' })
  recipientName: string;

  @Column({ name: 'recipient_phone', type: 'text', nullable: true })
  recipientPhone: string | null;

  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  @ManyToOne('ServiceZoneOrmEntity', { nullable: false })
  @JoinColumn([
    { name: 'agency_id', referencedColumnName: 'agencyId', foreignKeyConstraintName: 'quotes_agency_zone_service_zones_fk' },
    { name: 'zone_id', referencedColumnName: 'id' },
  ])
  zone?: object;

  /** The label of the zone on the day of the quote, copied: a zone corrected later does not rewrite the quote. */
  @Column({ name: 'zone_city', type: 'text' })
  zoneCity: string;

  @Column({ name: 'zone_district', type: 'text', nullable: true })
  zoneDistrict: string | null;

  @Column({ type: 'jsonb' })
  parcels: QuoteParcel[];

  @Column({ name: 'rate_card_version', type: 'integer', nullable: true })
  rateCardVersion: number | null;

  @Column({ name: 'pricing_status', type: 'text' })
  pricingStatus: 'priced' | 'out_of_scale' | 'no_tariff';

  @Column({ name: 'calculated_total_xaf', type: 'integer', nullable: true })
  calculatedTotalXaf: number | null;

  @Column({ name: 'manual_price_xaf', type: 'integer', nullable: true })
  manualPriceXaf: number | null;

  @Column({ name: 'manual_price_reason', type: 'text', nullable: true })
  manualPriceReason: string | null;

  @Column({ name: 'total_xaf', type: 'integer' })
  totalXaf: number;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  @Column({ name: 'issued_by', type: 'uuid' })
  issuedBy: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'issued_by', foreignKeyConstraintName: 'quotes_issued_by_users_id_fk' })
  issuer?: object;

  @Column({ name: 'valid_until', type: 'timestamptz' })
  validUntil: Date;

  @Column({ type: 'text' })
  status: 'issued' | 'accepted';

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'accepted_by', type: 'uuid', nullable: true })
  acceptedBy: string | null;

  @ManyToOne('UserOrmEntity', { nullable: true })
  @JoinColumn({ name: 'accepted_by', foreignKeyConstraintName: 'quotes_accepted_by_users_id_fk' })
  accepter?: object;
}
