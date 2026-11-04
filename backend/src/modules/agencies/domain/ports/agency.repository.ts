import { Agency } from '../agency';

export const AGENCY_REPOSITORY = Symbol('AgencyRepository');

export interface AgencyRepository {
  add(agency: Agency): Promise<void>;
}
