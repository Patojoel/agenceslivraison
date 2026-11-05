export interface ReadPublicPricingRepository {
  /** Zone identifier to the lowest price, in XAF, of the version in force; empty when the agency has no rate card. */
  startingPricesByZone(agencyId: string): Promise<ReadonlyMap<string, number>>;
}

export const READ_PUBLIC_PRICING_REPOSITORY = Symbol('ReadPublicPricingRepository');
