import { singleLine } from './plain-text';

export class SiteAddress {
  private constructor(readonly value: string) {}

  static of(raw: string): SiteAddress {
    return new SiteAddress(singleLine(raw, 'address', 5, 300));
  }
}
