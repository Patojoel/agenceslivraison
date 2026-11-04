import { RawLine } from '../../../domain/rate-card-content';

export interface CreateRateCardCommand {
  readonly actorId: string;
  readonly agencyId: string;
  readonly volumetricDivisor: number | null;
  readonly lines: readonly RawLine[];
}
