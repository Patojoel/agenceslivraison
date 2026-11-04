import { Identifier } from '@shared/domain/value-objects/identifier';

/** The identifier of a zone the agency serves. Rate cards (B3) will point at the same zone through it. */
export class ServiceZoneId extends Identifier {
  private readonly kind = 'ServiceZoneId';

  static of(value: string): ServiceZoneId {
    return new ServiceZoneId(value);
  }
}
