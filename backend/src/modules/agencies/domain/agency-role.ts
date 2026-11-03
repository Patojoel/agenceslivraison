export const AGENCY_ROLES = ['owner', 'admin', 'agent'] as const;
export type AgencyRole = typeof AGENCY_ROLES[number];

/** An invitation never creates an owner. */
export const INVITATION_ROLES = ['admin', 'agent'] as const;
export type InvitationRole = typeof INVITATION_ROLES[number];
