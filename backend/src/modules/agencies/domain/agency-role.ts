export const AGENCY_ROLES = ['owner', 'admin', 'agent'] as const;
export type AgencyRole = typeof AGENCY_ROLES[number];

/** An invitation never creates an owner. */
export const INVITATION_ROLES = ['admin', 'agent'] as const;
export type InvitationRole = typeof INVITATION_ROLES[number];

/**
 * The rights of a role are allow-lists with one entry per role: a new role does not compile until
 * every table below says what it may do, and a role missing at runtime has no right.
 */
const CONFIGURES_AGENCY: Readonly<Record<AgencyRole, boolean>> = { owner: true, admin: true, agent: false };
const SUBMITS_AGENCY: Readonly<Record<AgencyRole, boolean>> = { owner: true, admin: false, agent: false };
const INVITABLE_ROLES: Readonly<Record<AgencyRole, readonly AgencyRole[]>> = { owner: ['admin', 'agent'], admin: ['agent'], agent: [] };
const MANAGEABLE_ROLES: Readonly<Record<AgencyRole, readonly AgencyRole[]>> = { owner: ['owner', 'admin', 'agent'], admin: ['agent'], agent: [] };

function ownEntry<T>(table: Readonly<Record<AgencyRole, T>>, role: AgencyRole): T | undefined {
  return Object.hasOwn(table, role) ? table[role] : undefined;
}

/** Owners and administrators manage the identity of the agency, and so are the only ones to read it in full. */
export function managesAgencyIdentity(role: AgencyRole): boolean {
  return ownEntry(CONFIGURES_AGENCY, role) === true;
}

/** Only an owner submits the agency to verification. */
export function submitsAgency(role: AgencyRole): boolean {
  return ownEntry(SUBMITS_AGENCY, role) === true;
}

export function canInvite(role: AgencyRole, invited: AgencyRole): boolean {
  return ownEntry(INVITABLE_ROLES, role)?.includes(invited) === true;
}

/** Whether a member of this role may manage (change or remove) a member holding `target`, so never beyond their own reach. */
export function canManage(role: AgencyRole, target: AgencyRole): boolean {
  return ownEntry(MANAGEABLE_ROLES, role)?.includes(target) === true;
}

export function isAgencyRole(value: string): value is AgencyRole {
  return AGENCY_ROLES.some(role => role === value);
}
