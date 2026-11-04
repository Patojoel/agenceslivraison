import { RawSiteChange } from '../../../domain/agency-site';

export interface UpdateAgencySiteCommand {
  readonly actorId: string;
  readonly agencyId: string;
  readonly siteId: string;
  /** The site version the caller read; the change only applies on top of it. */
  readonly expectedVersion: number;
  readonly changes: RawSiteChange;
}
