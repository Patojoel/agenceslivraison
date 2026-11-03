import { MigrationInterface, QueryRunner } from 'typeorm';
import { DrizzleHistoryRow, findDrizzleAdoptionProblem } from '@shared/infrastructure/persistence/typeorm/drizzle-adoption';

/** Final state of the Drizzle migrations 0001 to 0006, which this baseline replaces. */
const STATEMENTS = [
  `CREATE TABLE "users" (
    "id" uuid PRIMARY KEY NOT NULL,
    "email" text,
    "password_hash" text,
    "account_type" text,
    CONSTRAINT "users_credentials_complete" CHECK (("email" IS NULL AND "password_hash" IS NULL AND "account_type" IS NULL) OR ("email" IS NOT NULL AND "password_hash" IS NOT NULL AND "account_type" IN ('individual', 'merchant')))
  )`,
  'CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email")',
  `CREATE TABLE "sessions" (
    "id" uuid PRIMARY KEY NOT NULL,
    "user_id" uuid NOT NULL,
    "token_digest" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "sessions_digest_format" CHECK ("token_digest" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "sessions_version_positive" CHECK ("version" > 0),
    CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
  )`,
  'CREATE UNIQUE INDEX "sessions_token_digest_unique" ON "sessions" USING btree ("token_digest")',
  `CREATE TABLE "identity_audit" (
    "id" uuid PRIMARY KEY NOT NULL,
    "user_id" uuid NOT NULL,
    "action" text NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
    "agency_id" uuid,
    "subject_user_id" uuid,
    CONSTRAINT "identity_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
  )`,
  'CREATE TABLE "agencies" ("id" uuid PRIMARY KEY NOT NULL)',
  `CREATE TABLE "agency_memberships" (
    "id" uuid PRIMARY KEY NOT NULL,
    "agency_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "role" text NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "agency_memberships_valid_role" CHECK ("role" IN ('owner', 'admin', 'agent')),
    CONSTRAINT "agency_memberships_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "agency_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
  )`,
  'CREATE UNIQUE INDEX "agency_memberships_agency_user_unique" ON "agency_memberships" USING btree ("agency_id", "user_id")',
  `CREATE TABLE "agency_invitations" (
    "id" uuid PRIMARY KEY NOT NULL,
    "agency_id" uuid NOT NULL,
    "email" text NOT NULL,
    "role" text NOT NULL,
    "token_digest" text NOT NULL,
    "created_by" uuid NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    CONSTRAINT "agency_invitations_role" CHECK ("role" IN ('admin', 'agent')),
    CONSTRAINT "agency_invitations_digest" CHECK ("token_digest" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "agency_invitations_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "agency_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
  )`,
  'CREATE UNIQUE INDEX "agency_invitations_token_unique" ON "agency_invitations" USING btree ("token_digest")',
];

export class Baseline1793710789928 implements MigrationInterface {
  name = 'Baseline1793710789928';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [legacy] = await queryRunner.query(`SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists`);
    if (legacy?.exists) {
      const versions: { version: string }[] = await queryRunner.query('SELECT version FROM public.schema_migrations');
      if (versions.some(row => row.version !== '0001_initial')) throw new Error('Unknown legacy migrations require manual review');
    }
    const [drizzle] = await queryRunner.query(`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`);
    if (drizzle?.exists) {
      // A database created by the Drizzle releases already has this exact schema: adopt it as is.
      const history: DrizzleHistoryRow[] = await queryRunner.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id');
      const indexes: { indexname: string }[] = await queryRunner.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE 'CREATE UNIQUE INDEX%'",
      );
      const problem = findDrizzleAdoptionProblem(history, indexes.map(row => row.indexname));
      if (problem) throw new Error(problem);
      return;
    }
    for (const statement of STATEMENTS) await queryRunner.query(statement);
  }

  async down(): Promise<void> {
    throw new Error('The baseline cannot be reverted');
  }
}
