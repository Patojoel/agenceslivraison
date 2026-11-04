import { Identifier } from '@shared/domain/value-objects/identifier';

/** The zone an agency serves, known by identity only: the same identifier as in the `agencies` module. */
export class ZoneId extends Identifier {
  private readonly kind = 'PricingZoneId';

  static of(value: string): ZoneId {
    return new ZoneId(value);
  }
}
