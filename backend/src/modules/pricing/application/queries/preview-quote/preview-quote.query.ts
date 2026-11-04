import { RawParcel } from '../../../domain/rate-card-version';

export interface PreviewQuoteQuery {
  readonly agencyId: string;
  readonly userId: string;
  readonly zoneId: string;
  readonly parcels: readonly RawParcel[];
}
