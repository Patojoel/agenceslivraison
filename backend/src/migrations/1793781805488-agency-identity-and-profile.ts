import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The rest of the agency identity (contact e-mail, RCCM, NIU), the profile description, and the format
 * rules of every identity column. Identity columns have always been empty (nothing wrote them before
 * this change), so the checks cannot reject an existing row. The audit table gains a nullable `details`
 * column for safe metadata, such as the names of the fields a person changed.
 */
const STATEMENTS = [
  `ALTER TABLE "identity_audit" ADD "details" jsonb`,
  `ALTER TABLE "agencies"
    ADD "description" text,
    ADD "contact_email" text,
    ADD "rccm" text,
    ADD "niu" text`,
  `ALTER TABLE "agencies"
    ADD CONSTRAINT "agencies_description_length" CHECK ("description" IS NULL OR char_length("description") BETWEEN 1 AND 1000),
    ADD CONSTRAINT "agencies_legal_name_length" CHECK ("legal_name" IS NULL OR char_length("legal_name") BETWEEN 2 AND 200),
    ADD CONSTRAINT "agencies_headquarters_city_length" CHECK ("headquarters_city" IS NULL OR char_length("headquarters_city") BETWEEN 2 AND 80),
    ADD CONSTRAINT "agencies_headquarters_address_length" CHECK ("headquarters_address" IS NULL OR char_length("headquarters_address") BETWEEN 5 AND 300),
    ADD CONSTRAINT "agencies_primary_phone_format" CHECK ("primary_phone" IS NULL OR "primary_phone" ~ '^\\+237[26][0-9]{8}$'),
    ADD CONSTRAINT "agencies_contact_email_length" CHECK ("contact_email" IS NULL OR char_length("contact_email") BETWEEN 3 AND 254),
    ADD CONSTRAINT "agencies_rccm_length" CHECK ("rccm" IS NULL OR char_length("rccm") BETWEEN 5 AND 40),
    ADD CONSTRAINT "agencies_niu_format" CHECK ("niu" IS NULL OR "niu" ~ '^[A-Za-z0-9]{14}$')`,
];

export class AgencyIdentityAndProfile1793781805488 implements MigrationInterface {
  name = 'AgencyIdentityAndProfile1793781805488';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
  }

  async down(): Promise<void> {
    throw new Error('This migration cannot be reverted');
  }
}
