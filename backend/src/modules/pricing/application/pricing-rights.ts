import type { MemberRole } from './ports/agency-access.port';

/**
 * The rights of a role are allow-lists with one entry per role: a new role of `agencies` does not compile until each
 * table says what it may do, and a role missing at runtime has no right.
 */
const WRITES_RATE_CARD: Readonly<Record<MemberRole, boolean>> = { owner: true, admin: true, agent: false };
const READS_PRICING: Readonly<Record<MemberRole, boolean>> = { owner: true, admin: true, agent: true };

function ownEntry(table: Readonly<Record<MemberRole, boolean>>, role: MemberRole): boolean {
  return Object.hasOwn(table, role) && table[role] === true;
}

/** Owners and administrators create and version the rate card, like the rest of the agency configuration. */
export function mayWriteRateCard(role: MemberRole): boolean {
  return ownEntry(WRITES_RATE_CARD, role);
}

/** Every active member reads the rate card and its history, and simulates a price. */
export function mayReadPricing(role: MemberRole): boolean {
  return ownEntry(READS_PRICING, role);
}
