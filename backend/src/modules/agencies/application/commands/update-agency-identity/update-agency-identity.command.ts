import { RawIdentityChange } from '../../../domain/agency-identity';

export interface UpdateAgencyIdentityCommand {
  readonly actorId: string;
  readonly agencyId: string;
  /** The version the caller read; the change only applies on top of it. */
  readonly expectedVersion: number;
  readonly changes: RawIdentityChange;
}
