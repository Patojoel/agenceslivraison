import { RawProfileChange } from '../../../domain/agency-identity';

export interface UpdateAgencyProfileCommand {
  readonly actorId: string;
  readonly agencyId: string;
  /** The version the caller read; the change only applies on top of it. */
  readonly expectedVersion: number;
  readonly changes: RawProfileChange;
}
