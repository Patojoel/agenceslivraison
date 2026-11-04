import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The audit names the resource an action touched (a zone, a site…) in a dedicated column rather than in
 * `details`: it is a typed, indexable identifier and not free-form metadata. Nullable, with no foreign
 * key (the audit must outlive any resource), so existing rows and the actions without a resource are untouched.
 */
export class AuditResourceId1793785151369 implements MigrationInterface {
  name = 'AuditResourceId1793785151369';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "identity_audit" ADD "resource_id" uuid');
  }

  async down(): Promise<void> {
    throw new Error('This migration cannot be reverted');
  }
}
