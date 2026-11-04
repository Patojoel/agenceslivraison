export const AGENCY_ROLES = ['owner', 'admin', 'agent'] as const;
export type AgencyRole = typeof AGENCY_ROLES[number];

/** An invitation never creates an owner. */
export const INVITATION_ROLES = ['admin', 'agent'] as const;
export type InvitationRole = typeof INVITATION_ROLES[number];

/** Owners and administrators manage the identity of the agency, and so are the only ones to read it in full. */
export function managesAgencyIdentity(role: AgencyRole): boolean {
  return role !== 'agent';
}

export function isAgencyRole(value: string): value is AgencyRole {
  return AGENCY_ROLES.some(role => role === value);
}
