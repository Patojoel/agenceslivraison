import { RawSiteDetails } from '../../../domain/agency-site';

export interface CreateAgencySiteCommand extends RawSiteDetails {
  readonly actorId: string;
  readonly agencyId: string;
}
