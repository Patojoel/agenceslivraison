import { cameroonPhone } from './cameroon-phone';

export class PrimaryPhone {
  private constructor(readonly value: string) {}

  static of(raw: string): PrimaryPhone {
    return new PrimaryPhone(cameroonPhone(raw, 'primaryPhone'));
  }
}
