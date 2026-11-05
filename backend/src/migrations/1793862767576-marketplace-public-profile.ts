/**
 * Public fiche of the marketplace: `agency_public_profiles` (whether an agency shows itself and under which address; never
 * deleted, so the unique slug is never given to another agency) and `public_agency_listings`, the projection the directory
 * reads (closed list of public fields, rewritten by the subscriber of the module). Only new tables: no existing row is touched.
 */
import { MigrationInterface, QueryRunner } from "typeorm";

export class MarketplacePublicProfile1793862767576 implements MigrationInterface {
    name = 'MarketplacePublicProfile1793862767576'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "public_agency_listings" (
                "agency_id" uuid NOT NULL,
                "slug" text NOT NULL,
                "name" text NOT NULL,
                "name_key" text NOT NULL,
                "description" text,
                "verification" text NOT NULL,
                "capabilities" text array NOT NULL,
                "zones" jsonb NOT NULL,
                "site_cities" text array NOT NULL,
                "published_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "visible" boolean NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "public_agency_listings_visible_needs_capability" CHECK (
                    NOT "visible"
                    OR cardinality("capabilities") > 0
                ),
                CONSTRAINT "public_agency_listings_zones_array" CHECK (jsonb_typeof("zones") = 'array'),
                CONSTRAINT "public_agency_listings_capabilities_known" CHECK (
                    "capabilities" <@ ARRAY ['delivery', 'storage']::text []
                ),
                CONSTRAINT "public_agency_listings_verification_values" CHECK ("verification" = 'unverified'),
                CONSTRAINT "public_agency_listings_description_length" CHECK (
                    "description" IS NULL
                    OR char_length("description") BETWEEN 1 AND 1000
                ),
                CONSTRAINT "public_agency_listings_name_length" CHECK (
                    char_length("name") BETWEEN 2 AND 120
                ),
                CONSTRAINT "public_agency_listings_pkey" PRIMARY KEY ("agency_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "public_agency_listings_visible_name_idx" ON "public_agency_listings" ("name_key", "slug")
            WHERE "visible"
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "public_agency_listings_slug_unique" ON "public_agency_listings" ("slug")
        `);
        await queryRunner.query(`
            CREATE TABLE "agency_public_profiles" (
                "agency_id" uuid NOT NULL,
                "slug" text NOT NULL,
                "published" boolean NOT NULL,
                "published_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "published_by" uuid NOT NULL,
                "unpublished_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "agency_public_profiles_withdrawn_after_published" CHECK (
                    "unpublished_at" IS NULL
                    OR "unpublished_at" >= "published_at"
                ),
                CONSTRAINT "agency_public_profiles_published_matches_withdrawal" CHECK ("published" = ("unpublished_at" IS NULL)),
                CONSTRAINT "agency_public_profiles_slug_shape" CHECK (
                    "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                    AND char_length("slug") BETWEEN 3 AND 80
                ),
                CONSTRAINT "agency_public_profiles_pkey" PRIMARY KEY ("agency_id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "agency_public_profiles_slug_unique" ON "agency_public_profiles" ("slug")
        `);
        await queryRunner.query(`
            ALTER TABLE "public_agency_listings"
            ADD CONSTRAINT "public_agency_listings_agency_id_agency_public_profiles_fk" FOREIGN KEY ("agency_id") REFERENCES "agency_public_profiles"("agency_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "agency_public_profiles"
            ADD CONSTRAINT "agency_public_profiles_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "agency_public_profiles"
            ADD CONSTRAINT "agency_public_profiles_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(): Promise<void> {
        throw new Error('This migration cannot be reverted');
    }
}
