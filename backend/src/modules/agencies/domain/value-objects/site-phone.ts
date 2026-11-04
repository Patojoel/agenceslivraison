import { cameroonPhone } from './cameroon-phone';

export class SitePhone {
  private constructor(readonly value: string) {}

  static of(raw: string): SitePhone {
    return new SitePhone(cameroonPhone(raw, 'phone'));
  }
}
