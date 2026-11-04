import { RawLine } from '../../../domain/rate-card-content';

export interface PublishRateCardVersionCommand {
  readonly actorId: string;
  readonly agencyId: string;
  /** The number of the version in force the author read (`If-Match`). */
  readonly expectedVersion: number;
  readonly volumetricDivisor: number | null;
  readonly lines: readonly RawLine[];
}
