import { Identifier } from '@shared/domain/value-objects/identifier';

/** The agency a public profile belongs to, known by identity only. */
export class AgencyId extends Identifier {
  private readonly kind = 'MarketplaceAgencyId';

  static of(value: string): AgencyId {
    return new AgencyId(value);
  }
}
