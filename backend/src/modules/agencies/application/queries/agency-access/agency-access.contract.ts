/**
 * Public API of `agencies` for the modules that work for an agency, next to `AgencyAccessReader`: the roles a member can
 * hold and what an agency may say of itself in public. Other modules import them from here and from nowhere else in the
 * domain of `agencies`.
 */
export { AGENCY_ROLES } from '../../../domain/agency-role';
export type { AgencyRole } from '../../../domain/agency-role';
export type { AgencyPublicView } from '../../read-models/agency-public-view.read-model';
