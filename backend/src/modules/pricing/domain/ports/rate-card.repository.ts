import { RateCard } from '../rate-card';
import { AgencyId } from '../value-objects/agency-id';

export const RATE_CARD_REPOSITORY = Symbol('RateCardRepository');

export interface RateCardRepository {
  /** The rate card of the agency with the version in force, without holding anything: for reads such as the simulation. */
  findByAgency(agencyId: AgencyId): Promise<RateCard | null>;
  /** The same, holding the rate card row until the transaction ends: the first step of every new version. */
  lockByAgency(agencyId: AgencyId): Promise<RateCard | null>;
  /** Writes a new rate card and its version 1; an agency that has one already makes it throw `RateCardAlreadyExists`, whoever got there first. */
  add(card: RateCard): Promise<void>;
  /** Appends the version the aggregate gained since it was loaded; versions already written are never updated. */
  save(card: RateCard): Promise<void>;
}
