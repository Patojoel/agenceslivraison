import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Accounts created without credentials (agency onboarding to come) have no email, hash nor type. */
@Entity({ name: 'users' })
@Index('users_email_unique', ['email'], { unique: true })
@Check('users_credentials_complete', `("email" IS NULL AND "password_hash" IS NULL AND "account_type" IS NULL) OR ("email" IS NOT NULL AND "password_hash" IS NOT NULL AND "account_type" IN ('individual', 'merchant'))`)
export class UserOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'users_pkey' })
  id: string;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'account_type', type: 'text', nullable: true })
  accountType: string | null;
}
