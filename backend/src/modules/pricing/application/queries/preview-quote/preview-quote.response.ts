import { QuotedParcel } from '../../../domain/rate-card-version';

export interface PreviewQuoteResponse {
  readonly currency: 'XAF';
  /** Always true: a simulation promises nothing, only a quote does. */
  readonly indicative: true;
  readonly notice: string;
  readonly status: 'priced' | 'out_of_scale' | 'no_tariff';
  /** The version in force that was used; `null` when the agency has no rate card. */
  readonly version: number | null;
  readonly zoneId: string;
  /** Empty when there is no tariff. */
  readonly parcels: readonly QuotedParcel[];
  /** Only when every parcel is inside the scale. */
  readonly total: number | null;
}
