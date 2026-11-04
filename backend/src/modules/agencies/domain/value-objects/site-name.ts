import { comparisonKey, singleLine } from './plain-text';

export class SiteName {
  private constructor(readonly value: string) {}

  static of(raw: string): SiteName {
    return new SiteName(singleLine(raw, 'name', 2, 120));
  }

  get key(): string { return comparisonKey(this.value); }
}
