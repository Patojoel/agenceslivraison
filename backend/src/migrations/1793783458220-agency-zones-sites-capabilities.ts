import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The configuration of an agency becomes data: the zones it serves (service_zones, whose identifier the
 * rate cards of the pricing lot will reuse), its sites (agency_sites, versioned one by one) and the
 * append-only history of its capabilities (agency_capability_transitions, whose last row per type is
 * the current state). Only new tables: no existing row is touched. The partial unique indexes keep two
 * active zones, or two active sites with one name, from ever existing, whatever the application does.
 */
const STATEMENTS = [
  `CREATE TABLE "service_zones" ("id" uuid NOT NULL, "agency_id" uuid NOT NULL, "city" text NOT NULL, "district" text, "city_key" text NOT NULL, "district_key" text NOT NULL, "added_at" TIMESTAMP WITH TIME ZONE NOT NULL, "retired_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "service_zones_retired_after_added" CHECK ("retired_at" IS NULL OR "retired_at" >= "added_at"), CONSTRAINT "service_zones_keys_match" CHECK (("district" IS NULL) = ("district_key" = '')), CONSTRAINT "service_zones_district_length" CHECK ("district" IS NULL OR char_length("district") BETWEEN 2 AND 80), CONSTRAINT "service_zones_city_length" CHECK (char_length("city") BETWEEN 2 AND 80), CONSTRAINT "service_zones_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX "service_zones_agency_area_idx" ON "service_zones" ("agency_id", "city_key", "district_key", "id")`,
  `CREATE UNIQUE INDEX "service_zones_active_area_unique" ON "service_zones" ("agency_id", "city_key", "district_key") WHERE "retired_at" IS NULL`,
  `CREATE UNIQUE INDEX "service_zones_agency_id_id_unique" ON "service_zones" ("agency_id", "id")`,
  `CREATE TABLE "agency_sites" ("id" uuid NOT NULL, "agency_id" uuid NOT NULL, "name" text NOT NULL, "name_key" text NOT NULL, "city" text NOT NULL, "address" text NOT NULL, "phone" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "deactivated_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "agency_sites_deactivated_after_created" CHECK ("deactivated_at" IS NULL OR "deactivated_at" >= "created_at"), CONSTRAINT "agency_sites_version_positive" CHECK ("version" > 0), CONSTRAINT "agency_sites_phone_format" CHECK ("phone" IS NULL OR "phone" ~ '^\\+237[26][0-9]{8}$'), CONSTRAINT "agency_sites_address_length" CHECK (char_length("address") BETWEEN 5 AND 300), CONSTRAINT "agency_sites_city_length" CHECK (char_length("city") BETWEEN 2 AND 80), CONSTRAINT "agency_sites_name_length" CHECK (char_length("name") BETWEEN 2 AND 120), CONSTRAINT "agency_sites_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX "agency_sites_agency_name_idx" ON "agency_sites" ("agency_id", "name_key", "id")`,
  `CREATE UNIQUE INDEX "agency_sites_active_name_unique" ON "agency_sites" ("agency_id", "name_key") WHERE "deactivated_at" IS NULL`,
  `CREATE TABLE "agency_capability_transitions" ("agency_id" uuid NOT NULL, "type" text NOT NULL, "sequence" integer NOT NULL, "kind" text NOT NULL, "reason" text, "actor_id" uuid NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "agency_capability_transitions_reason_length" CHECK ("reason" IS NULL OR char_length("reason") BETWEEN 3 AND 500), CONSTRAINT "agency_capability_transitions_reason_matches_kind" CHECK (("kind" = 'suspended') = ("reason" IS NOT NULL)), CONSTRAINT "agency_capability_transitions_sequence_positive" CHECK ("sequence" > 0), CONSTRAINT "agency_capability_transitions_kind_valid" CHECK ("kind" IN ('activated', 'suspended')), CONSTRAINT "agency_capability_transitions_type_valid" CHECK ("type" IN ('delivery', 'storage')), CONSTRAINT "agency_capability_transitions_pkey" PRIMARY KEY ("agency_id", "type", "sequence"))`,
  `ALTER TABLE "service_zones" ADD CONSTRAINT "service_zones_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "agency_sites" ADD CONSTRAINT "agency_sites_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "agency_capability_transitions" ADD CONSTRAINT "agency_capability_transitions_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "agency_capability_transitions" ADD CONSTRAINT "agency_capability_transitions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
];

export class AgencyZonesSitesCapabilities1793783458220 implements MigrationInterface {
  name = 'AgencyZonesSitesCapabilities1793783458220';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
  }

  async down(): Promise<void> {
    throw new Error('This migration cannot be reverted');
  }
}
