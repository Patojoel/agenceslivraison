import { singleLine } from './plain-text';

export class SiteCity {
  private constructor(readonly value: string) {}

  static of(raw: string): SiteCity {
    return new SiteCity(singleLine(raw, 'city', 2, 80));
  }
}
