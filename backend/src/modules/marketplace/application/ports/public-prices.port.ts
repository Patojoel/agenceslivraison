/** What marketplace needs of pricing: the lowest price per zone of the rate card in force. */
export interface PublicPrices {
  /** Zone identifier to the lowest price, in XAF, of the version in force; empty when the agency has no rate card. */
  startingPricesByZone(agencyId: string): Promise<ReadonlyMap<string, number>>;
}

export const PUBLIC_PRICES = Symbol('PublicPrices');
