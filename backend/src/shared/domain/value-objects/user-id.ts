import { Identifier } from './identifier';

export class UserId extends Identifier {
  private readonly kind = 'UserId';

  static of(value: string): UserId {
    return new UserId(value);
  }
}
