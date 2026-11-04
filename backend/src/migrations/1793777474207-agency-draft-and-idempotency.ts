import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agencies gain a trade name, a status, a creator and room for the onboarding identity; the shared
 * `idempotency_keys` table is created. Agencies that existed before get a placeholder trade name and
 * their earliest owner (or any member) as creator, so the new NOT NULL columns can be enforced.
 */
const STATEMENTS = [
  `CREATE TABLE "idempotency_keys" (
    "actor_id" uuid NOT NULL,
    "scope" text NOT NULL,
    "key" text NOT NULL,
    "request_hash" text NOT NULL,
    "resource_id" uuid NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("actor_id", "scope", "key"),
    CONSTRAINT "idempotency_keys_key_length" CHECK (char_length("key") BETWEEN 8 AND 128),
    CONSTRAINT "idempotency_keys_request_hash_format" CHECK ("request_hash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "idempotency_keys_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
  )`,
  `ALTER TABLE "agencies"
    ADD "trade_name" text,
    ADD "status" text NOT NULL DEFAULT 'draft',
    ADD "version" integer NOT NULL DEFAULT 1,
    ADD "created_by" uuid,
    ADD "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    ADD "legal_name" text,
    ADD "headquarters_city" text,
    ADD "headquarters_address" text,
    ADD "primary_phone" text,
    ADD "submitted_at" timestamp with time zone,
    ADD "submitted_by" uuid`,
  `UPDATE "agencies" SET "trade_name" = 'Agence ' || left("id"::text, 8)`,
  `UPDATE "agencies" SET "created_by" = (
    SELECT "membership"."user_id" FROM "agency_memberships" "membership"
    WHERE "membership"."agency_id" = "agencies"."id"
    ORDER BY ("membership"."role" = 'owner') DESC, "membership"."id" LIMIT 1
  )`,
];

const CONSTRAINTS = [
  `ALTER TABLE "agencies"
    ALTER COLUMN "trade_name" SET NOT NULL,
    ALTER COLUMN "created_by" SET NOT NULL,
    ADD CONSTRAINT "agencies_status_valid" CHECK ("status" IN ('draft', 'submitted')),
    ADD CONSTRAINT "agencies_trade_name_length" CHECK (char_length("trade_name") BETWEEN 2 AND 120),
    ADD CONSTRAINT "agencies_version_positive" CHECK ("version" > 0),
    ADD CONSTRAINT "agencies_submission_recorded" CHECK ("status" <> 'submitted' OR ("submitted_at" IS NOT NULL AND "submitted_by" IS NOT NULL)),
    ADD CONSTRAINT "agencies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT "agencies_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
];

export class AgencyDraftAndIdempotency1793777474207 implements MigrationInterface {
  name = 'AgencyDraftAndIdempotency1793777474207';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
    const [orphans]: { total: number }[] = await queryRunner.query('SELECT count(*)::int AS total FROM "agencies" WHERE "created_by" IS NULL');
    if (orphans && orphans.total > 0) throw new Error('Agencies without any membership need a manual review before this migration');
    for (const statement of CONSTRAINTS) await queryRunner.query(statement);
  }

  async down(): Promise<void> {
    throw new Error('This migration cannot be reverted');
  }
}
