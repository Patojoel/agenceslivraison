import { Identifier } from '../../../../shared/domain/vo/identifier';

export class InvitationId extends Identifier {
  private readonly kind = 'InvitationId';

  static of(value: string): InvitationId {
    return new InvitationId(value);
  }
}
