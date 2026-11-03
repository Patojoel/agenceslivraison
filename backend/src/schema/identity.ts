import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  passwordHash: text('password_hash'),
  accountType: text('account_type'),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
  check('users_credentials_complete', sql`(${table.email} IS NULL AND ${table.passwordHash} IS NULL AND ${table.accountType} IS NULL) OR (${table.email} IS NOT NULL AND ${table.passwordHash} IS NOT NULL AND ${table.accountType} IN ('individual', 'merchant'))`),
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenDigest: text('token_digest').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  version: integer('version').notNull().default(1),
}, (table) => [
  uniqueIndex('sessions_token_digest_unique').on(table.tokenDigest),
  check('sessions_digest_format', sql`${table.tokenDigest} ~ '^[a-f0-9]{64}$'`),
  check('sessions_version_positive', sql`${table.version} > 0`),
]);

export const identityAudit = pgTable('identity_audit', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  agencyId: uuid('agency_id'),
  subjectUserId: uuid('subject_user_id'),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// Agency onboarding will enrich this identity with its business profile.
export const agencies = pgTable('agencies', {
  id: uuid('id').primaryKey(),
});

export const agencyMemberships = pgTable('agency_memberships', {
  id: uuid('id').primaryKey(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text('role').notNull(),
  active: boolean('active').notNull().default(true),
}, (table) => [
  uniqueIndex('agency_memberships_agency_user_unique').on(table.agencyId, table.userId),
  check('agency_memberships_valid_role', sql`${table.role} IN ('owner', 'admin', 'agent')`),
]);

export const agencyInvitations = pgTable('agency_invitations', {
  id: uuid('id').primaryKey(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id),
  email: text('email').notNull(),
  role: text('role').notNull(),
  tokenDigest: text('token_digest').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('agency_invitations_token_unique').on(table.tokenDigest),
  check('agency_invitations_role', sql`${table.role} IN ('admin', 'agent')`),
  check('agency_invitations_digest', sql`${table.tokenDigest} ~ '^[a-f0-9]{64}$'`),
]);
