import { Identifier } from '@shared/domain/value-objects/identifier';

export class MembershipId extends Identifier {
  private readonly kind = 'MembershipId';

  static of(value: string): MembershipId {
    return new MembershipId(value);
  }
}
