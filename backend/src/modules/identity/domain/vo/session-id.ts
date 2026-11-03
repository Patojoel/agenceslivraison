import { Identifier } from '../../../../shared/domain/vo/identifier';

export class SessionId extends Identifier {
  private readonly kind = 'SessionId';

  static of(value: string): SessionId {
    return new SessionId(value);
  }
}
