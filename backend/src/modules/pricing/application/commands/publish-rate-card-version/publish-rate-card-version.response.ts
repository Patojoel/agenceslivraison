import { RateCardReadModel } from '../../read-models/rate-card.read-model';

export interface PublishRateCardVersionResponse {
  /** `false` when the scale was identical to the one in force: nothing was written and the version in force is answered. */
  readonly changed: boolean;
  readonly rateCard: RateCardReadModel;
}
