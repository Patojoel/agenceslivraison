/**
 * Public API of `agencies` for the modules that work for an agency, next to `AgencyAccessReader`: the roles a member can
 * hold. Other modules import the roles from here and from nowhere else in the domain of `agencies`.
 */
export { AGENCY_ROLES } from '../../../domain/agency-role';
export type { AgencyRole } from '../../../domain/agency-role';
