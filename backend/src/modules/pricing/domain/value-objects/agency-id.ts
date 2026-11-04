import { Identifier } from '@shared/domain/value-objects/identifier';

/** The agency a rate card belongs to, known by identity only. */
export class AgencyId extends Identifier {
  private readonly kind = 'PricingAgencyId';

  static of(value: string): AgencyId {
    return new AgencyId(value);
  }
}
