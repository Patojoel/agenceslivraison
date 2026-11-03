import { Identifier } from '@shared/domain/value-objects/identifier';

export class SessionId extends Identifier {
  private readonly kind = 'SessionId';

  static of(value: string): SessionId {
    return new SessionId(value);
  }
}
