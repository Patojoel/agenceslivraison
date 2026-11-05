/**
 * Search keys of the public directory (B3.10, B3.11): the cities and the districts a fiche is served in, already in comparison
 * form (no case, accents or repeated spaces), so that the city and district filters are an equality on the key and not a
 * function applied to the zones of every row. The rows already written are completed here with the same rule as the
 * application (`domain/comparison-key.ts`), restated because a migration must not change with the code. No index: the
 * measures of the lot (2 000 and 20 000 fiches, docs/routes/marketplace.md) show that the alphabetical index of the visible
 * rows is enough at the expected volume.
 */
import { MigrationInterface, QueryRunner } from "typeorm";

const SEPARATOR = String.fromCharCode(31);

function keyOf(text: string): string {
    return text.replace(/\s+/g, ' ').trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

interface ZoneJson { city: string; district: string | null }

export class PublicListingSearchKeys1793900000000 implements MigrationInterface {
    name = 'PublicListingSearchKeys1793900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public_agency_listings" ADD "city_keys" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "public_agency_listings" ADD "district_keys" text array NOT NULL DEFAULT '{}'`);
        const rows: { agency_id: string; zones: ZoneJson[]; site_cities: string[] }[] = await queryRunner.query(
            `SELECT "agency_id", "zones", "site_cities" FROM "public_agency_listings"`,
        );
        for (const row of rows) {
            const cityKeys = [...new Set([...row.zones.map(zone => keyOf(zone.city)), ...row.site_cities.map(keyOf)])].sort();
            const districtKeys = [...new Set(row.zones.map(zone => `${keyOf(zone.city)}${SEPARATOR}${zone.district === null ? '' : keyOf(zone.district)}`))].sort();
            await queryRunner.query(
                `UPDATE "public_agency_listings" SET "city_keys" = $2::text[], "district_keys" = $3::text[] WHERE "agency_id" = $1::uuid`,
                [row.agency_id, cityKeys, districtKeys],
            );
        }
        await queryRunner.query(`ALTER TABLE "public_agency_listings" ALTER COLUMN "city_keys" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "public_agency_listings" ALTER COLUMN "district_keys" DROP DEFAULT`);
    }

    public async down(): Promise<void> {
        throw new Error('This migration cannot be reverted');
    }
}
