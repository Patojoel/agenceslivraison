import type { MemberRole } from './ports/agency-access.port';

/**
 * The rights of a role are allow-lists with one entry per role: a new role of `agencies` does not compile until each
 * table says what it may do, and a role missing at runtime has no right.
 */
const PUBLISHES_PROFILE: Readonly<Record<MemberRole, boolean>> = { owner: true, admin: false, agent: false };
const READS_PROFILE_STATE: Readonly<Record<MemberRole, boolean>> = { owner: true, admin: true, agent: true };

function ownEntry(table: Readonly<Record<MemberRole, boolean>>, role: MemberRole): boolean {
  return Object.hasOwn(table, role) && table[role] === true;
}

/** The owner alone decides to show the agency on the marketplace or to withdraw it (D-05). */
export function mayPublishProfile(role: MemberRole): boolean {
  return ownEntry(PUBLISHES_PROFILE, role);
}

/** The state of the fiche (address, visibility, what hides it) concerns the whole team and holds nothing private. */
export function mayReadProfileState(role: MemberRole): boolean {
  return ownEntry(READS_PROFILE_STATE, role);
}
