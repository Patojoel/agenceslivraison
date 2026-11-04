import { RawParcel } from '../../../domain/rate-card-version';

export interface IssueQuoteCommand {
  readonly actorId: string;
  readonly agencyId: string;
  readonly recipientName: string;
  readonly recipientPhone: string | null;
  readonly zoneId: string;
  readonly parcels: readonly RawParcel[];
  /** The price the member retains instead of the calculated one, with its reason. */
  readonly manual: { readonly price: number; readonly reason: string } | null;
  readonly idempotencyKey: string | null;
}
