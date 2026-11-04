/** A zone the agency serves or served, as the other modules may read it: a label and whether it is still served. */
export interface AgencyZoneView {
  readonly id: string;
  readonly city: string;
  readonly district: string | null;
  readonly active: boolean;
}

/** What the delivery side of an agency says about itself: its delivery capability and every zone, active or retired. */
export interface AgencyDeliveryState {
  readonly deliveryActive: boolean;
  readonly zones: readonly AgencyZoneView[];
}
