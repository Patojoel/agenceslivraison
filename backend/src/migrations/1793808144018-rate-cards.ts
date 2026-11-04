import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The delivery rate card of an agency: one `rate_cards` row per agency (unique `agency_id`), whose versions are
 * written once in `rate_card_versions` and whose tiers are written with them in `rate_card_lines`; nothing is ever updated
 * except the number of the version in force. Every row carries its agency and is tied to its parent by a composite
 * foreign key, so a version cannot sit under another agency, and a line cannot price a zone of another agency:
 * `(agency_id, zone_id)` references `service_zones(agency_id, id)`, the guarantee of the database whatever the application does.
 * Only new tables: no existing row is touched.
 */
const STATEMENTS = [
  `CREATE TABLE "rate_cards" ("id" uuid NOT NULL, "agency_id" uuid NOT NULL, "current_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "rate_cards_current_version_positive" CHECK ("current_version" > 0), CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "rate_cards_agency_id_id_unique" ON "rate_cards" ("agency_id", "id")`,
  `CREATE UNIQUE INDEX "rate_cards_agency_id_unique" ON "rate_cards" ("agency_id")`,
  `CREATE TABLE "rate_card_versions" ("rate_card_id" uuid NOT NULL, "number" integer NOT NULL, "agency_id" uuid NOT NULL, "volumetric_divisor" integer, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "rate_card_versions_divisor_range" CHECK ("volumetric_divisor" IS NULL OR "volumetric_divisor" BETWEEN 1000 AND 10000), CONSTRAINT "rate_card_versions_number_positive" CHECK ("number" > 0), CONSTRAINT "rate_card_versions_pkey" PRIMARY KEY ("rate_card_id", "number"))`,
  `CREATE UNIQUE INDEX "rate_card_versions_agency_card_number_unique" ON "rate_card_versions" ("agency_id", "rate_card_id", "number")`,
  `CREATE TABLE "rate_card_lines" ("rate_card_id" uuid NOT NULL, "version_number" integer NOT NULL, "zone_id" uuid NOT NULL, "position" smallint NOT NULL, "agency_id" uuid NOT NULL, "max_weight_grams" integer NOT NULL, "price_xaf" integer NOT NULL, CONSTRAINT "rate_card_lines_price_range" CHECK ("price_xaf" BETWEEN 1 AND 10000000), CONSTRAINT "rate_card_lines_max_weight_range" CHECK ("max_weight_grams" BETWEEN 1 AND 1000000), CONSTRAINT "rate_card_lines_position_range" CHECK ("position" BETWEEN 1 AND 20), CONSTRAINT "rate_card_lines_pkey" PRIMARY KEY ("rate_card_id", "version_number", "zone_id", "position"))`,
  `CREATE UNIQUE INDEX "rate_card_lines_version_zone_bound_unique" ON "rate_card_lines" ("rate_card_id", "version_number", "zone_id", "max_weight_grams")`,
  `ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "rate_card_versions" ADD CONSTRAINT "rate_card_versions_agency_rate_card_rate_cards_fk" FOREIGN KEY ("agency_id", "rate_card_id") REFERENCES "rate_cards"("agency_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "rate_card_versions" ADD CONSTRAINT "rate_card_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "rate_card_lines" ADD CONSTRAINT "rate_card_lines_agency_version_rate_card_versions_fk" FOREIGN KEY ("agency_id", "rate_card_id", "version_number") REFERENCES "rate_card_versions"("agency_id", "rate_card_id", "number") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "rate_card_lines" ADD CONSTRAINT "rate_card_lines_agency_zone_service_zones_fk" FOREIGN KEY ("agency_id", "zone_id") REFERENCES "service_zones"("agency_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
];

export class RateCards1793808144018 implements MigrationInterface {
  name = 'RateCards1793808144018';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
  }

  async down(): Promise<void> {
    throw new Error('This migration cannot be reverted');
  }
}
