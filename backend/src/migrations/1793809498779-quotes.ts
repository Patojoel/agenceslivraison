import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quotes: one `quotes` row per quote, written with a complete copy of its calculation (version, zone label, parcels,
 * prices, total) and changed only by its acceptance, from `issued` to `accepted`; and `quote_sequences`, the counter that
 * gives each agency its references `DEV-<year>-<number>`, locked by the statement that increments it. Every quote carries its
 * agency: `(agency_id, reference)` is unique, and `(agency_id, zone_id)` references `service_zones(agency_id, id)`, so a quote
 * cannot name a zone of another agency. The checks keep the amounts whole and tie the total to the price retained.
 * Only new tables: no existing row is touched.
 */
const STATEMENTS = [
  `CREATE TABLE "quotes" ("id" uuid NOT NULL, "agency_id" uuid NOT NULL, "reference" text NOT NULL, "recipient_name" text NOT NULL, "recipient_phone" text, "zone_id" uuid NOT NULL, "zone_city" text NOT NULL, "zone_district" text, "parcels" jsonb NOT NULL, "rate_card_version" integer, "pricing_status" text NOT NULL, "calculated_total_xaf" integer, "manual_price_xaf" integer, "manual_price_reason" text, "total_xaf" integer NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL, "issued_by" uuid NOT NULL, "valid_until" TIMESTAMP WITH TIME ZONE NOT NULL, "status" text NOT NULL, "accepted_at" TIMESTAMP WITH TIME ZONE, "accepted_by" uuid, CONSTRAINT "quotes_accepted_within_validity" CHECK ("accepted_at" IS NULL OR ("accepted_at" >= "issued_at" AND "accepted_at" <= "valid_until")), CONSTRAINT "quotes_acceptance_complete" CHECK (("status" = 'accepted') = ("accepted_at" IS NOT NULL) AND ("accepted_at" IS NULL) = ("accepted_by" IS NULL)), CONSTRAINT "quotes_status_values" CHECK ("status" IN ('issued', 'accepted')), CONSTRAINT "quotes_validity_after_issue" CHECK ("valid_until" > "issued_at"), CONSTRAINT "quotes_total_is_price_retained" CHECK ("total_xaf" = COALESCE("manual_price_xaf", "calculated_total_xaf")), CONSTRAINT "quotes_priced_by_calculation_or_by_hand" CHECK ("manual_price_xaf" IS NOT NULL OR "calculated_total_xaf" IS NOT NULL), CONSTRAINT "quotes_total_range" CHECK ("total_xaf" BETWEEN 1 AND 200000000), CONSTRAINT "quotes_manual_price_with_reason" CHECK (("manual_price_xaf" IS NULL) = ("manual_price_reason" IS NULL)), CONSTRAINT "quotes_manual_reason_length" CHECK ("manual_price_reason" IS NULL OR char_length("manual_price_reason") BETWEEN 3 AND 300), CONSTRAINT "quotes_manual_price_range" CHECK ("manual_price_xaf" IS NULL OR "manual_price_xaf" BETWEEN 1 AND 10000000), CONSTRAINT "quotes_calculated_total_range" CHECK ("calculated_total_xaf" IS NULL OR "calculated_total_xaf" BETWEEN 1 AND 200000000), CONSTRAINT "quotes_calculated_total_when_priced" CHECK (("pricing_status" = 'priced') = ("calculated_total_xaf" IS NOT NULL)), CONSTRAINT "quotes_pricing_status_values" CHECK ("pricing_status" IN ('priced', 'out_of_scale', 'no_tariff')), CONSTRAINT "quotes_rate_card_version_positive" CHECK ("rate_card_version" IS NULL OR "rate_card_version" > 0), CONSTRAINT "quotes_parcels_array" CHECK (jsonb_typeof("parcels") = 'array' AND jsonb_array_length("parcels") BETWEEN 1 AND 20), CONSTRAINT "quotes_recipient_phone_format" CHECK ("recipient_phone" IS NULL OR "recipient_phone" ~ '^[+]237[26][0-9]{8}$'), CONSTRAINT "quotes_recipient_name_length" CHECK (char_length("recipient_name") BETWEEN 2 AND 120), CONSTRAINT "quotes_reference_format" CHECK ("reference" ~ '^DEV-[0-9]{4}-[0-9]{6}$'), CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX "quotes_agency_issued_at_id_idx" ON "quotes" ("agency_id", "issued_at", "id")`,
  `CREATE UNIQUE INDEX "quotes_agency_reference_unique" ON "quotes" ("agency_id", "reference")`,
  `CREATE TABLE "quote_sequences" ("agency_id" uuid NOT NULL, "year" integer NOT NULL, "last_number" integer NOT NULL, CONSTRAINT "quote_sequences_last_number_range" CHECK ("last_number" BETWEEN 1 AND 999999), CONSTRAINT "quote_sequences_year_range" CHECK ("year" BETWEEN 2000 AND 9999), CONSTRAINT "quote_sequences_pkey" PRIMARY KEY ("agency_id", "year"))`,
  `ALTER TABLE "quotes" ADD CONSTRAINT "quotes_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "quotes" ADD CONSTRAINT "quotes_agency_zone_service_zones_fk" FOREIGN KEY ("agency_id", "zone_id") REFERENCES "service_zones"("agency_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "quotes" ADD CONSTRAINT "quotes_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "quotes" ADD CONSTRAINT "quotes_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "quote_sequences" ADD CONSTRAINT "quote_sequences_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
];

export class Quotes1793809498779 implements MigrationInterface {
  name = 'Quotes1793809498779';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
  }

  async down(): Promise<void> {
    throw new Error('This migration cannot be reverted');
  }
}
